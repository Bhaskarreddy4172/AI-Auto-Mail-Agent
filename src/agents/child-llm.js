import { ollamaChat } from '../llm/ollama.js';
import { searchProducts, formatProductResults, getAllProductsText, COMPANY_INFO } from './product-knowledge.js';
import config from '../config.js';
import logger from '../logger.js';

const CHILD_MODEL = config.ollama.draftingModel; // uses same model (qwen2:0.5b)

/**
 * Child LLM Agent — specializes in TechBott product knowledge.
 *
 * The parent orchestrator calls this when an email mentions products,
 * pricing, specs, or anything the product knowledge base can answer.
 * It searches the local product DB, then uses the LLM to synthesize
 * a product-aware answer that the parent LLM uses as context.
 */
export async function queryChildLLM(query, emailContext = {}) {
  logger.info(`  [Child LLM] Query: "${query.slice(0, 80)}..."`);

  // 1. Search the product knowledge base (limit to top 5 for faster LLM response)
  const allResults = searchProducts(query);
  const searchResults = allResults.slice(0, 5);
  const productContext = searchResults.length > 0
    ? formatProductResults(searchResults)
    : getAllProductsText();  // fallback: give it everything

  logger.info(`  [Child LLM] Found ${allResults.length} matching product(s), using top ${searchResults.length}`);

  // 2. Build prompt for the child LLM
  const systemPrompt = `You are the Product Knowledge Specialist for ${COMPANY_INFO.name}.
You have deep expertise in all TechBott India products — printers, lasers, consumables, and automation systems.

Your job is to answer product-related questions accurately using ONLY the product data provided below.
Do NOT invent specifications, prices, features, or URLs that are not in the data.
Do NOT make up download links or website URLs.
If information is not available in the data, say so clearly.

Be concise and factual. Format your answer as bullet points when listing features or specs.

=== COMPANY INFO ===
Company: ${COMPANY_INFO.name}
Headquarters: ${COMPANY_INFO.headquarters}
Phone: ${COMPANY_INFO.phone.join(', ')}
Email: ${COMPANY_INFO.email}
Industries Served: ${COMPANY_INFO.industries.join(', ')}
Key Benefits: ${COMPANY_INFO.usp.join('; ')}

=== PRODUCT DATA ===
${productContext}`;

  const userMessage = buildChildQuery(query, emailContext);

  try {
    const response = await ollamaChat(
      CHILD_MODEL,
      systemPrompt,
      userMessage,
      { temperature: 0.3, maxTokens: 512, repeat_penalty: 1.3 } // low temp for accuracy, high repeat penalty
    );

    logger.info(`  [Child LLM] Response generated (${response.length} chars)`);
    return {
      success: true,
      answer: response,
      productsFound: searchResults.map(r => r.product.category),
      source: 'child-llm',
    };
  } catch (err) {
    logger.error(`  [Child LLM] Failed: ${err.message}`);
    // Graceful fallback: return raw product data without LLM processing
    return {
      success: false,
      answer: productContext,
      productsFound: searchResults.map(r => r.product.category),
      source: 'product-db-fallback',
    };
  }
}

/**
 * Detect whether an email body or classification likely needs product knowledge.
 */
export function needsProductKnowledge(email, classification) {
  const text = `${email.subject} ${email.body}`.toLowerCase();

  const productKeywords = [
    'product', 'printer', 'laser', 'cij', 'tij', 'tto', 'dod',
    'inkjet', 'ink', 'ribbon', 'cartridge', 'conveyor', 'labeling',
    'label', 'packing', 'marking', 'coding', 'engraving',
    'fiber', 'co2', 'uv', 'thermal', 'overprinter',
    'specification', 'spec', 'feature', 'model', 'price', 'pricing',
    'cost', 'quote', 'quotation', 'catalogue', 'catalog', 'brochure',
    'jet3', 'jet2', 'leibinger', 'linx', 'sealtronic',
    'hi-res', 'high-resolution', 'batch', 'expiry', 'barcode', 'qr code',
    'techbott', 'printing solution', 'automation',
  ];

  const intentsThatNeedProducts = [
    'product_inquiry', 'pricing_request', 'sales_inquiry',
    'technical_support', 'feature_request', 'general_inquiry',
  ];

  const keywordMatch = productKeywords.some(kw => text.includes(kw));
  const intentMatch = intentsThatNeedProducts.includes(classification?.intent);

  return keywordMatch || intentMatch;
}

/**
 * Extract a focused product query from the email for the child LLM.
 */
export function extractProductQuery(email, classification) {
  const parts = [];

  if (classification?.summary) {
    parts.push(classification.summary);
  }

  if (classification?.topics?.length > 0) {
    parts.push(`Topics: ${classification.topics.join(', ')}`);
  }

  // Extract key sentences mentioning products
  const sentences = email.body.split(/[.!?\n]+/).filter(s => s.trim().length > 10);
  const productSentences = sentences.filter(s => {
    const lower = s.toLowerCase();
    return /printer|laser|ink|ribbon|product|spec|feature|model|price|quote|cij|tij|tto|dod|conveyor|label|marking|coding/i.test(lower);
  });

  if (productSentences.length > 0) {
    parts.push(productSentences.slice(0, 3).join('. '));
  }

  return parts.join('\n') || email.subject;
}

function buildChildQuery(query, emailContext) {
  let msg = `Question about TechBott products:\n${query}`;

  if (emailContext.from) {
    msg += `\n\nThis question came from an email by ${emailContext.from}.`;
  }
  if (emailContext.intent) {
    msg += `\nEmail type: ${emailContext.intent}`;
  }

  msg += '\n\nProvide a concise, factual answer based on the product data.';
  return msg;
}
