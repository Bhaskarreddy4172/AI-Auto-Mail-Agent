import config from '../config.js';
import logger from '../logger.js';

// Dynamic imports based on mode
let emailModule = null;

/**
 * Initialize the email system based on EMAIL_MODE config.
 * - 'imap' = IMAP/SMTP with Gmail App Password (simpler setup)
 * - 'api'  = Gmail API with OAuth2 (requires Google Cloud project)
 */
export async function initEmail() {
  if (config.emailMode === 'imap') {
    emailModule = await import('./imap-smtp.js');
    emailModule.initSmtp();
    logger.info('Email mode: IMAP/SMTP (App Password)');
  } else {
    emailModule = await import('./gmail.js');
    emailModule.initGmail();
    logger.info('Email mode: Gmail API (OAuth2)');
  }
}

export async function fetchUnreadEmails(maxResults = 10) {
  if (!emailModule) throw new Error('Email not initialized');
  return emailModule.fetchUnreadEmails(maxResults);
}

export async function fetchRecentEmails(maxResults = 10) {
  if (!emailModule) throw new Error('Email not initialized');
  return emailModule.fetchRecentEmails(maxResults);
}

export async function fetchThread(threadId) {
  if (!emailModule) throw new Error('Email not initialized');
  return emailModule.fetchThread(threadId);
}

export async function markAsRead(messageId) {
  if (!emailModule) throw new Error('Email not initialized');
  return emailModule.markAsRead(messageId);
}

export async function createDraft(originalEmail, replyBody) {
  if (!emailModule) throw new Error('Email not initialized');
  return emailModule.createDraft(originalEmail, replyBody);
}

export async function sendEmail(to, subject, body, attachments = []) {
  if (!emailModule) throw new Error('Email not initialized');
  if (emailModule.sendEmail) {
    return emailModule.sendEmail(to, subject, body, attachments);
  }
  throw new Error('sendEmail not implemented in the current email module');
}

export function getAuthUrl() {
  if (config.emailMode === 'imap') {
    return null; // No OAuth needed for IMAP mode
  }
  // Only available in API mode
  const gmailModule = emailModule;
  return gmailModule?.getAuthUrl?.() || null;
}

export async function exchangeCode(code) {
  if (config.emailMode === 'imap') {
    throw new Error('OAuth not needed in IMAP mode');
  }
  return emailModule?.exchangeCode?.(code);
}
