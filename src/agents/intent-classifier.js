import { ollamaChat } from '../llm/ollama.js';
import config from '../config.js';
import logger from '../logger.js';

const INTENT_TYPES = [
  'customer_complaint',
  'customer_inquiry',
  'quotation_request',
  'follow_up',
  'support_request',
  'sales_inquiry',
  'internal_communication',
  'meeting_request',
  'feedback',
  'escalation',
  'spam',
  'other',
];

const URGENCY_LEVELS = ['critical', 'high', 'medium', 'low'];

const SYSTEM_PROMPT = `You are an email classification AI for ${config.agent.companyName}.

${config.agent.companyName} is an industrial printing company selling CIJ printers, TIJ printers, laser coders, TTO printers, DOD printers, and related consumables.

Analyze the incoming email and return ONLY a valid JSON object with these fields:
- "intent": one of [${INTENT_TYPES.map(t => `"${t}"`).join(', ')}]
- "urgency": one of [${URGENCY_LEVELS.map(u => `"${u}"`).join(', ')}]
- "sentiment": one of ["positive", "neutral", "negative", "angry"]
- "topics": array of 1-5 key topics (strings)
- "requiresEscalation": boolean — true if this needs human attention beyond normal reply
- "summary": a 1-2 sentence summary of the email
- "senderType": one of ["customer", "prospect", "partner", "internal", "vendor", "unknown"]

IMPORTANT RULES:
- Automated emails from no-reply addresses (Google, social media, newsletters, system alerts) → intent="spam"
- Emails asking about products, pricing, manuals, maintenance → intent="customer_inquiry", senderType="customer"
- Emails complaining about a product or service issue → intent="customer_complaint", senderType="customer"
- A person emailing from a personal/business address asking about your products is a "customer", NOT a "partner"
- If an email starts with "Hi" or similar greetings, DO NOT classify it simply as a greeting. Ignore the greeting and focus entirely on the other keywords and the core message to determine the true intent.

Return ONLY the JSON, no markdown fences, no explanation.`;

/**
 * Classify an email's intent, urgency, sentiment, and topics.
 * @param {object} email - Parsed email object
 * @returns {object} Classification result
 */
export async function classifyEmail(email) {
  const userMessage = `From: ${email.from}
Subject: ${email.subject}
Date: ${email.date}
Has Attachments: ${email.attachments?.length > 0 ? 'Yes' : 'No'}

Body:
${email.body.slice(0, 3000)}`;

  try {
    const raw = await ollamaChat(
      config.ollama.classificationModel,
      SYSTEM_PROMPT,
      userMessage,
      { temperature: 0.1, maxTokens: 512 }
    );

    const classification = parseJsonResponse(raw);

    // Validate fields
    if (!INTENT_TYPES.includes(classification.intent)) {
      classification.intent = 'other';
    }
    if (!URGENCY_LEVELS.includes(classification.urgency)) {
      classification.urgency = 'medium';
    }

    logger.info(`Classified email "${email.subject}" → intent=${classification.intent}, urgency=${classification.urgency}`);
    return classification;
  } catch (err) {
    logger.error(`Classification failed for "${email.subject}": ${err.message}`);
    return {
      intent: 'other',
      urgency: 'medium',
      sentiment: 'neutral',
      topics: [],
      requiresEscalation: true,
      summary: 'Classification failed — flagged for human review.',
      senderType: 'unknown',
    };
  }
}

function parseJsonResponse(raw) {
  // Strip markdown fences if LLM wraps them
  let cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  return JSON.parse(cleaned);
}
