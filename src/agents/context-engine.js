import { ollamaChat } from '../llm/ollama.js';
import { fetchThread } from '../email/adapter.js';
import { searchMemory } from '../memory/vector-store.js';
import { getCustomerHistory } from '../memory/database.js';
import config from '../config.js';
import logger from '../logger.js';

const SYSTEM_PROMPT = `You are a context analysis AI for ${config.agent.companyName}.

Given an email and its related context (thread history, customer history, company knowledge), produce a context report as a JSON object:

- "threadSummary": summary of the email thread so far (or "New conversation" if first email)
- "customerRelationship": what we know about this sender (or "Unknown" if new)
- "relevantPolicies": array of relevant company policies/knowledge that apply
- "previousIssues": array of past issues or interactions with this sender
- "keyContext": 1-3 sentence summary of the most important context for drafting a reply
- "suggestedApproach": brief recommendation on how to approach the reply

Return ONLY valid JSON, no markdown fences.`;

/**
 * Build a rich context object for the email by gathering thread history,
 * customer history, and relevant knowledge from vector store.
 */
export async function buildContext(email, classification) {
  const context = {
    threadHistory: [],
    customerHistory: null,
    relevantKnowledge: [],
    analysis: null,
  };

  // 1. Fetch thread history
  try {
    if (email.threadId) {
      const thread = await fetchThread(email.threadId);
      context.threadHistory = thread.map(m => ({
        from: m.from,
        date: m.date,
        body: m.body.slice(0, 1000),
      }));
    }
  } catch (err) {
    logger.warn(`Could not fetch thread for ${email.threadId}: ${err.message}`);
  }

  // 2. Fetch customer history from DB
  try {
    const senderEmail = extractEmailAddress(email.from);
    context.customerHistory = await getCustomerHistory(senderEmail);
  } catch (err) {
    logger.warn(`Could not fetch customer history: ${err.message}`);
  }

  // 3. Search relevant company knowledge from vector store
  try {
    const query = `${classification.summary || ''} ${(classification.topics || []).join(' ')}`.trim();
    if (query) {
      context.relevantKnowledge = await searchMemory(query, 5);
    }
  } catch (err) {
    logger.warn(`Vector search failed: ${err.message}`);
  }

  // 4. Run context analysis with LLM
  try {
    const userMessage = buildContextPrompt(email, context);
    const raw = await ollamaChat(
      config.ollama.reasoningModel,
      SYSTEM_PROMPT,
      userMessage,
      { temperature: 0.2, maxTokens: 1024 }
    );
    context.analysis = parseJson(raw);
    logger.info(`Context built for "${email.subject}"`);
  } catch (err) {
    logger.warn(`Context analysis LLM call failed: ${err.message}`);
    context.analysis = {
      threadSummary: context.threadHistory.length > 1 ? 'Ongoing thread' : 'New conversation',
      customerRelationship: 'Unknown',
      relevantPolicies: [],
      previousIssues: [],
      keyContext: 'No context analysis available.',
      suggestedApproach: 'Proceed with standard reply.',
    };
  }

  return context;
}

function buildContextPrompt(email, context) {
  const parts = [`--- CURRENT EMAIL ---
From: ${email.from}
Subject: ${email.subject}
Date: ${email.date}
Body:
${email.body.slice(0, 2000)}`];

  if (context.threadHistory.length > 1) {
    parts.push(`\n--- THREAD HISTORY (${context.threadHistory.length} messages) ---`);
    for (const msg of context.threadHistory.slice(-5)) {
      parts.push(`From: ${msg.from} (${msg.date})\n${msg.body}\n---`);
    }
  }

  if (context.customerHistory) {
    parts.push(`\n--- CUSTOMER HISTORY ---\n${JSON.stringify(context.customerHistory, null, 2)}`);
  }

  if (context.relevantKnowledge.length > 0) {
    parts.push(`\n--- RELEVANT COMPANY KNOWLEDGE ---`);
    for (const k of context.relevantKnowledge) {
      parts.push(`• ${k.document || k}`);
    }
  }

  return parts.join('\n');
}

function extractEmailAddress(fromField) {
  const match = fromField.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase() : fromField.toLowerCase().trim();
}

function parseJson(raw) {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  return JSON.parse(cleaned);
}
