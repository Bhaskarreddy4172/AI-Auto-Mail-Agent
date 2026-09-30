import { classifyEmail } from './intent-classifier.js';
import { buildContext } from './context-engine.js';
import { generateReply } from './reply-generator.js';
import { checkPolicy, deepPolicyReview } from './policy-checker.js';
import { queryChildLLM, needsProductKnowledge, extractProductQuery } from './child-llm.js';
import { getLiveStockData } from './live-data.js';
import { generateQuotationPDF } from './quote-generator.js';
import { storeEmailMemory } from '../memory/vector-store.js';
import { logEmail, updateEmailStatus } from '../memory/database.js';
import { createDraft, markAsRead, fetchUnreadEmails, fetchRecentEmails, sendEmail } from '../email/adapter.js';
import config from '../config.js';
import logger from '../logger.js';

// ─── In-memory activity log (since PostgreSQL may not be running) ───
const activityLog = [];
const MAX_LOG_SIZE = 200;

// ─── New Leads List (in-memory) ───
const leadsList = [];
const MAX_LEADS = 500;

export function getLeadsList() {
  return leadsList.slice().reverse(); // newest first
}

function addLead(email, classification) {
  const existingIdx = leadsList.findIndex(l => l.email === extractEmail(email.from));
  if (existingIdx >= 0) return; // already tracked
  leadsList.push({
    name: extractDisplayName(email.from),
    email: extractEmail(email.from),
    subject: email.subject,
    intent: classification?.intent || 'unknown',
    summary: classification?.summary || '',
    date: new Date().toISOString(),
  });
  if (leadsList.length > MAX_LEADS) leadsList.shift();
  logger.info(`  ★ New lead added: ${extractEmail(email.from)}`);
}

// ─── Known customer list (add real customer emails here) ───
const KNOWN_CUSTOMERS = new Set([
  // Add known customer emails in lowercase
]);

function isKnownCustomer(email) {
  const addr = extractEmail(email.from);
  return KNOWN_CUSTOMERS.has(addr);
}

function extractEmail(from) {
  const match = (from || '').match(/<([^>]+)>/);
  return (match ? match[1] : from || '').toLowerCase().trim();
}

function extractDisplayName(from) {
  const match = (from || '').match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : extractEmail(from);
}

export function getActivityLog() {
  return activityLog.slice().reverse(); // newest first
}

function logActivity(entry) {
  activityLog.push({ ...entry, timestamp: new Date().toISOString() });
  if (activityLog.length > MAX_LOG_SIZE) activityLog.shift();
}

// ─── Global processing lock (shared between polling and API) ───
let _isProcessing = false;

export function isProcessing() {
  return _isProcessing;
}

/**
 * The Parent Email Agent — orchestrates the full pipeline:
 *   Read → Classify → Context → Generate → Policy Check → Draft
 */
export async function processNewEmails() {
  if (_isProcessing) {
    logger.info('Previous cycle still running, skipping...');
    return [];
  }
  _isProcessing = true;
  try {
    return await _processNewEmailsInner();
  } finally {
    _isProcessing = false;
  }
}

/**
 * Process recent emails (including already-read ones).
 */
export async function processRecentEmails(count = 5) {
  if (_isProcessing) {
    logger.info('Previous cycle still running, skipping...');
    return [];
  }
  _isProcessing = true;
  try {
    logger.info(`─── Processing last ${count} recent emails ───`);
    let emails;
    try {
      emails = await fetchRecentEmails(count);
    } catch (err) {
      logger.error(`Failed to fetch recent emails: ${err.message}`);
      return [];
    }
    if (emails.length === 0) {
      logger.info('No emails found in inbox');
      return [];
    }
    const results = [];
    for (const email of emails) {
      try {
        const result = await processEmail(email);
        results.push(result);
      } catch (err) {
        logger.error(`Failed to process email "${email.subject}": ${err.message}`, { stack: err.stack });
        results.push({ emailId: email.id, subject: email.subject, status: 'error', error: err.message });
      }
    }
    logger.info(`─── Recent scan complete: ${results.length} email(s) processed ───`);
    return results;
  } finally {
    _isProcessing = false;
  }
}

async function _processNewEmailsInner() {
  logger.info('─── Email processing cycle started ───');

  let emails;
  try {
    emails = await fetchUnreadEmails(3);
  } catch (err) {
    logger.error(`Failed to fetch emails: ${err.message}`);
    return [];
  }

  if (emails.length === 0) {
    logger.info('No new emails to process');
    return [];
  }

  const results = [];

  for (const email of emails) {
    try {
      const result = await processEmail(email);
      results.push(result);
    } catch (err) {
      logger.error(`Failed to process email "${email.subject}": ${err.message}`, { stack: err.stack });
      results.push({
        emailId: email.id,
        subject: email.subject,
        status: 'error',
        error: err.message,
      });
    }
  }

  logger.info(`─── Cycle complete: ${results.length} email(s) processed ───`);
  return results;
}

/**
 * Process a single email through the full agent pipeline.
 */
export async function processEmail(email) {
  logger.info(`Processing: "${email.subject}" from ${email.from}`);

  // 0. MARK AS READ IMMEDIATELY to prevent duplicate processing
  try {
    await markAsRead(email.id);
  } catch (err) {
    logger.warn(`  Could not mark email as read: ${err.message}`);
  }

  // 0b. PRE-FILTER: Skip automated/no-reply system emails before wasting LLM calls
  if (isAutomatedEmail(email)) {
    logger.info(`  ✗ Skipping automated system email: "${email.subject}" from ${email.from}`);
    const skipResult = { emailId: email.id, subject: email.subject, status: 'spam_skipped', from: email.from, reason: 'no-reply/automated sender' };
    logActivity({ ...skipResult });
    return skipResult;
  }

  // 0c. IDENTIFY SENDER
  const senderAddr = extractEmail(email.from);
  const senderName = extractDisplayName(email.from);
  const customerType = isKnownCustomer(email) ? 'existing_customer' : 'new_contact';
  logger.info(`  → Sender: ${senderName} <${senderAddr}> [${customerType}]`);

  // 1. CLASSIFY
  logger.info('  → Step 1: Classifying intent...');
  const classification = await classifyEmail(email);

  // Skip spam
  if (classification.intent === 'spam') {
    logger.info(`  ✗ Skipping spam: "${email.subject}"`);
    const spamResult = { emailId: email.id, subject: email.subject, status: 'spam_skipped' };
    logActivity({ ...spamResult, from: email.from });
    return spamResult;
  }

  // 2. BUILD CONTEXT
  logger.info('  → Step 2: Building context...');
  const context = await buildContext(email, classification);

  // 2b. CHILD LLM — Product Knowledge
  let productKnowledge = null;
  let productAvailable = true;
  if (needsProductKnowledge(email, classification)) {
    logger.info('  → Step 2b: Querying Child LLM for product knowledge...');
    const productQuery = extractProductQuery(email, classification);
    productKnowledge = await queryChildLLM(productQuery, {
      from: email.from,
      intent: classification.intent,
    });
    logger.info(`  ✓ Child LLM responded (source: ${productKnowledge.source}, products: ${productKnowledge.productsFound.join(', ') || 'general'})`);

    // Check if the requested product is NOT in our catalog
    if (productKnowledge.productsFound.length === 0) {
      productAvailable = false;
      logger.info(`  ⚠ Product NOT found in TechBott catalog — will inform customer`);
    } else {
      const liveStockData = await getLiveStockData(productKnowledge.productsFound);
      productKnowledge.liveStockData = liveStockData;
      logger.info(`  ✓ Live stock data fetched`);
    }
  }

  // 3. CHECK IF ESCALATION NEEDED
  if (classification.requiresEscalation) {
    logger.warn(`  ⚠ Email requires escalation: "${email.subject}"`);
    await logEmail({
      messageId: email.id,
      threadId: email.threadId,
      sender: email.from,
      subject: email.subject,
      intent: classification.intent,
      urgency: classification.urgency,
      sentiment: classification.sentiment,
      status: 'escalated',
      policySafe: false,
      policyViolations: [{ rule: 'escalation', detail: 'Flagged during classification' }],
    });
    return {
      emailId: email.id,
      subject: email.subject,
      status: 'escalated',
      classification,
    };
  }

  // 2c. LOG product knowledge query to activity
  if (productKnowledge) {
    logActivity({
      type: 'child_llm',
      emailId: email.id,
      subject: email.subject,
      from: email.from,
      productsFound: productKnowledge.productsFound,
      source: productKnowledge.source,
      answerPreview: productKnowledge.answer?.slice(0, 200),
    });
  }

  // 3b. TRACK NEW LEADS
  if (customerType === 'new_contact') {
    addLead(email, classification);
  }

  // 4. GENERATE REPLY
  logger.info('  → Step 3: Generating reply...');
  const reply = await generateReply(email, classification, context, productKnowledge, { productAvailable, customerType });

  // 5. POLICY CHECK (Logging only, review bypassed)
  logger.info('  → Step 4: Running policy check (logging only)...');
  const policyResult = checkPolicy(reply.text, classification);

  let finalStatus = 'sent';
  let draftData = null;

  // 6. AUTO-SEND
  try {
    let finalBody = reply.text;
    const attachments = [];
    
    // Check for quotation JSON
    const quoteMatch = finalBody.match(/\[QUOTE_DATA:\s*(\{[\s\S]*?\})\s*\]/);
    if (quoteMatch) {
      try {
        logger.info('  → Generating PDF quotation...');
        const quoteData = JSON.parse(quoteMatch[1]);
        const pdfPath = await generateQuotationPDF(quoteData);
        attachments.push({ filename: 'Quotation.pdf', path: pdfPath });
        
        // Remove the JSON block from the email text
        finalBody = finalBody.replace(/\[QUOTE_DATA:\s*\{[\s\S]*?\}\s*\]/, '').trim();
      } catch (err) {
        logger.error(`  ✗ Failed to generate quotation: ${err.message}`);
      }
    }

    if (config.agent.draftOnlyMode) {
      logger.info('  → Step 5: Automatically creating draft (human review disabled)...');
      draftData = await createDraft(email, finalBody); // Draft attachments not supported in this simple mock
      finalStatus = 'drafted';
    } else {
      logger.info('  → Step 5: Automatically sending reply...');
      const subject = email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`;
      await sendEmail(email.from, subject, finalBody, attachments);
      finalStatus = 'sent';
    }
  } catch (err) {
    logger.error(`  ✗ Failed to auto-send/draft reply: ${err.message}`);
    finalStatus = 'failed';
  }

  // 7. LOG TO DATABASE
  await logEmail({
    messageId: email.id,
    threadId: email.threadId,
    sender: email.from,
    subject: email.subject,
    intent: classification.intent,
    urgency: classification.urgency,
    sentiment: classification.sentiment,
    personaUsed: reply.persona,
    draftId: draftData?.id || null,
    status: finalStatus,
    policySafe: policyResult.safe,
    policyViolations: policyResult.violations,
  });

  // 8. STORE IN MEMORY
  try {
    await storeEmailMemory(email, classification, reply.text);
  } catch (err) {
    logger.warn(`  Memory storage failed (non-critical): ${err.message}`);
  }

  logger.info(`  ✓ Done: "${email.subject}" → status=${finalStatus}, persona=${reply.persona}`);

  const result = {
    emailId: email.id,
    subject: email.subject,
    status: finalStatus,
    classification,
    persona: reply.persona,
    draftId: draftData?.id || null,
    policyResult,
    replyPreview: reply.text.slice(0, 200) + (reply.text.length > 200 ? '...' : ''),
    replyFull: reply.text,
    productKnowledge: productKnowledge ? {
      source: productKnowledge.source,
      productsFound: productKnowledge.productsFound,
      answer: productKnowledge.answer,
    } : null,
    productAvailable,
    customerType,
    senderEmail: senderAddr,
    from: email.from,
    date: email.date,
    bodyPreview: email.body?.slice(0, 300),
  };

  logActivity(result);
  return result;
}

/**
 * Detect automated/system emails that shouldn't get a reply.
 * Uses sender address patterns — much more reliable than LLM classification.
 */
function isAutomatedEmail(email) {
  const from = (email.from || '').toLowerCase();

  // Known no-reply patterns
  const noReplyPatterns = [
    'noreply@', 'no-reply@', 'no_reply@',
    'donotreply@', 'do-not-reply@', 'do_not_reply@',
    'mailer-daemon@', 'postmaster@',
    'notifications@', 'notify@', 'alert@', 'alerts@',
  ];
  if (noReplyPatterns.some(p => from.includes(p))) return true;

  // Known automated sender domains
  const automatedDomains = [
    'accounts.google.com', 'google.com', 'googleplay',
    'facebookmail.com', 'linkedin.com',
    'twitter.com', 'x.com',
    'github.com', 'amazonses.com',
  ];
  if (automatedDomains.some(d => from.includes(d))) return true;

  return false;
}
