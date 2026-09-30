import { getPendingFollowUps, updateEmailStatus } from '../memory/database.js';
import { getActiveOffers } from './offers-data.js';
import { ollamaChat } from '../llm/ollama.js';
import { createDraft } from '../email/adapter.js';
import config from '../config.js';
import logger from '../logger.js';

const FOLLOW_UP_SYSTEM_PROMPT = `You are a proactive Sales Agent for TechBott India.
Your task is to write a polite and professional follow-up email to a customer who previously inquired about our products, but the deal has not yet been closed.

Use the following guidelines:
1. Acknowledge their previous inquiry about the specific product.
2. Ask for a status update on their project or decision.
3. If there are active offers provided below, prominently mention them to encourage a purchase.
4. Keep the email concise, friendly, and persuasive.
5. Provide our contact number (+91 7337335751) for them to reach out and finalize the deal.

Use the following response format:
Subject: Following up on your inquiry regarding [Product]
Dear [Customer Name],
[Body of the email]
Best regards,
TechBott India Sales Team`;

export async function processFollowUps() {
  logger.info('─── Running Automated Follow-Up Agent ───');
  try {
    const pendingLeads = await getPendingFollowUps(3); // 3 days old
    
    if (pendingLeads.length === 0) {
      logger.info('No pending follow-ups needed at this time.');
      return;
    }

    logger.info(`Found ${pendingLeads.length} open deals requiring follow-up.`);

    for (const lead of pendingLeads) {
      await processSingleFollowUp(lead);
    }
  } catch (err) {
    logger.error(`Follow-up agent failed: ${err.message}`);
  }
}

async function processSingleFollowUp(lead) {
  try {
    logger.info(`Drafting follow-up for: ${lead.sender} (Subject: ${lead.subject})`);
    
    // Extract keywords simply from the original subject to find offers
    // In a real scenario, we might have saved the exact product they asked about in a 'products' column
    const keywords = lead.subject.split(' ').filter(w => w.length > 3);
    const activeOffers = getActiveOffers(keywords);
    
    let datasetContext = "No special offers available at this time. Just check in on their status.";
    if (activeOffers) {
      datasetContext = `ACTIVE OFFERS FOR THIS CUSTOMER:\n${activeOffers}`;
    }

    const userMessage = `Input:

PREVIOUS INQUIRY DETAILS:
From: ${lead.sender}
Original Subject: ${lead.subject}
Original Intent: ${lead.intent}

DATASET:
${datasetContext}`;

    const rawReply = await ollamaChat(
      config.ollama.draftingModel,
      FOLLOW_UP_SYSTEM_PROMPT,
      userMessage,
      { temperature: 0.7, maxTokens: 300 }
    );

    // Clean up LLM formatting
    let text = rawReply.replace(/^```[a-z]*\n?/i, '').replace(/```\s*$/i, '').trim();

    // The agent drafts an email, so we create a draft on Gmail
    const mockEmailContext = { 
      from: lead.sender, 
      subject: `Re: ${lead.subject}`,
      threadId: lead.thread_id
    };
    
    if (config.agent.draftOnlyMode !== false) {
      await createDraft(mockEmailContext, text);
    }
    
    // Mark the deal as follow-up sent so we don't spam them
    await updateEmailStatus(lead.message_id, 'follow_up_sent');
    logger.info(`✓ Follow-up draft created for ${lead.sender}`);

  } catch (err) {
    logger.error(`Failed to process follow-up for ${lead.sender}: ${err.message}`);
  }
}
