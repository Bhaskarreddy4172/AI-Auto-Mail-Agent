import { ollamaChat } from '../llm/ollama.js';
import { determineTone, buildToneInstructions } from './tone-engine.js';
import { selectPersona } from './personas.js';
import config from '../config.js';
import logger from '../logger.js';

/**
 * Generate a human-like reply to an email.
 */
export async function generateReply(email, classification, context, productKnowledge = null, opts = {}) {
  const { productAvailable = true, customerType = 'existing_customer' } = opts;
  const persona = selectPersona(classification);
  const tone = determineTone(classification, persona);
  const toneInstructions = buildToneInstructions(tone, persona);

  const systemPrompt = buildSystemPrompt(persona, toneInstructions);
  const userMessage = buildUserMessage(email, classification, context, productKnowledge, { productAvailable });

  // Pre-build greeting so the LLM doesn't have to figure out the name
  const senderName = extractSenderName(email.from);
  const greeting = `Dear ${senderName},`;

  try {
    const reply = await ollamaChat(
      config.ollama.draftingModel,
      systemPrompt,
      userMessage,
      { temperature: 0.7, maxTokens: 300, repeat_penalty: 1.3 }
    );

    const formatted = formatReply(reply, persona, greeting);
    logger.info(`Reply generated for "${email.subject}" using ${persona.name} persona`);
    return { text: formatted, persona: persona.name, tone };
  } catch (err) {
    logger.error(`Reply generation failed: ${err.message}`);
    throw err;
  }
}

function buildSystemPrompt(persona, toneInstructions) {
  return `You are an AI-powered Customer Email Response Agent. Your task is to automatically analyze incoming customer emails and generate accurate, relevant, professional, structured, and ready-to-send replies.

You are acting as the ${persona.name} persona. 
${toneInstructions}

STRICT WRITING RULES:
1. Keep every email to 2–4 short sentences whenever possible.
2. Focus only on the customer's enquiry and the required next action.
3. Do not add unnecessary company information, marketing language, or explanations.
4. Do not repeat information already provided by the customer.
5. Use simple, professional business English. Be direct and helpful. Prefer one clear action per email.
6. Avoid phrases such as "We are delighted", "We are pleased to inform you", "leveraging our extensive expertise", and other unnecessary corporate language.
7. Do not use long paragraphs. Accuracy is more important than adding detail.
8. Never invent prices, specifications, availability, delivery dates, certifications, or other facts.

QUOTATIONS:
Generate quotations automatically when all required quotation information (product, quantity, price) is available from the dataset.
If required quotation information is missing or cannot be verified, do not guess and do not generate a quotation; ask only for the missing information or clearly state that the quotation cannot yet be generated.
If you CAN generate a quote based on the dataset, you MUST append a JSON block at the very end of your email with exactly this format:
[QUOTE_DATA: {"items": [{"product": "Product Name", "quantity": 1, "price": 1000}], "customerName": "Name"}]

The dataset is the single source of truth. If a requested product is out of stock or unavailable, apologize gently for the inconvenience, provide the estimated restock date if available, and politely offer to help them find a suitable alternative.

Use the following response format:

Subject: [Relevant subject]

Dear [Customer Name],

[2-4 short sentences directly answering the enquiry and providing the next action.]

${persona.signOff},
${persona.signatureName || 'TechBott India Team'}
[QUOTE_DATA: {...}] (Only if a quote is being generated)

Generate ONLY the final ready-to-send customer email. Do not output analysis or reasoning.`;
}

function buildUserMessage(email, classification, context, productKnowledge = null, opts = {}) {
  let datasetContext = 'No specific product information found for this query. Escalate to human support.';
  if (productKnowledge?.answer) {
    datasetContext = productKnowledge.answer;
    if (productKnowledge.liveStockData) {
      datasetContext += `\n\nLIVE STOCK & AVAILABILITY DATA:\n${productKnowledge.liveStockData}`;
    }
  } else if (opts.productAvailable === false) {
    datasetContext = 'The product the customer asked about is NOT available in our catalog. Suggest they contact us for our available range of printing solutions.';
  }

  const emailBody = email.body || email.subject || 'Empty message';

  return `Input:

CUSTOMER EMAIL:
Subject: ${email.subject}
From: ${email.from}
Detected Intent: ${classification.intent}
Detected Sentiment: ${classification.sentiment}
Detected Urgency: ${classification.urgency}
Body:
${emailBody}

DATASET / KNOWLEDGE BASE:
${datasetContext}

YOUR REPLY:`;
}

function formatReply(rawReply, persona, greeting) {
  let text = rawReply.trim();
  // Remove formatting backticks if added by the LLM
  text = text.replace(/^```[a-z]*\n?/i, '').replace(/```\s*$/i, '').trim();
  // De-duplicate repeated paragraphs
  text = deduplicateParagraphs(text);
  return text;
}

/**
 * Remove repeated paragraphs/blocks that small LLMs tend to produce.
 */
function deduplicateParagraphs(text) {
  const paragraphs = text.split(/\n\n+/);
  const seen = new Set();
  const unique = [];

  for (const para of paragraphs) {
    // Normalize whitespace for comparison
    const key = para.trim().replace(/\s+/g, ' ').toLowerCase();
    if (key.length < 10) { unique.push(para); continue; } // keep short lines
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(para);
    }
  }

  return unique.join('\n\n');
}

/**
 * Extract the sender's first name from a "From" field like:
 *   "SAKETH GOTURI" <sakethgoturi93@gmail.com>  →  "Saketh"
 *   sakethgoturi93@gmail.com                    →  "there" (fallback)
 */
function extractSenderName(from) {
  if (!from) return 'there';

  // Try to extract quoted name: "Name" <email>
  const nameMatch = from.match(/^"?([^"<]+)"?\s*</);
  if (nameMatch) {
    const fullName = nameMatch[1].trim();
    if (fullName && !/^no[_-]?reply|noreply|mailer|daemon|notify|alert/i.test(fullName)) {
      // Title-case the first name
      const firstName = fullName.split(/\s+/)[0];
      return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
    }
  }

  // Try plain email: extract name from before @
  const emailMatch = from.match(/([^@<\s]+)@/);
  if (emailMatch) {
    const local = emailMatch[1];
    if (!/^no[_-]?reply|noreply|mailer|daemon|notify|alert|info|support|admin/i.test(local)) {
      const name = local.replace(/[._]/g, ' ').split(/\s+/)[0];
      return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    }
  }

  return 'there';
}
