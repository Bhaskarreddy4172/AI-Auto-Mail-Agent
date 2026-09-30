import { google } from 'googleapis';
import { convert } from 'html-to-text';
import sanitizeHtml from 'sanitize-html';
import config from '../config.js';
import logger from '../logger.js';

let authClient = null;
let gmail = null;

/**
 * Initialize the Gmail API client using OAuth2 credentials.
 */
export function initGmail() {
  const { clientId, clientSecret, redirectUri, refreshToken } = config.gmail;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Gmail credentials missing. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN in .env');
  }

  authClient = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  authClient.setCredentials({ refresh_token: refreshToken });
  gmail = google.gmail({ version: 'v1', auth: authClient });
  logger.info('Gmail API initialized');
}

/**
 * Get the OAuth2 authorization URL for initial token generation.
 */
export function getAuthUrl() {
  const { clientId, clientSecret, redirectUri } = config.gmail;
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.modify',
    ],
  });
}

/**
 * Exchange authorization code for tokens.
 */
export async function exchangeCode(code) {
  const { clientId, clientSecret, redirectUri } = config.gmail;
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const { tokens } = await oauth2.getToken(code);
  return tokens;
}

/**
 * Fetch unread emails from the inbox.
 * @param {number} maxResults
 * @returns {Array<ParsedEmail>}
 */
export async function fetchUnreadEmails(maxResults = 10) {
  if (!gmail) throw new Error('Gmail not initialized. Call initGmail() first.');

  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread in:inbox',
    maxResults,
  });

  const messages = res.data.messages || [];
  if (messages.length === 0) {
    logger.info('No unread emails found');
    return [];
  }

  logger.info(`Found ${messages.length} unread email(s)`);

  const emails = [];
  for (const msg of messages) {
    const email = await fetchEmailById(msg.id);
    if (email) emails.push(email);
  }

  return emails;
}

/**
 * Fetch a single email by ID and parse it.
 */
export async function fetchEmailById(messageId) {
  if (!gmail) throw new Error('Gmail not initialized');

  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  return parseGmailMessage(res.data);
}

/**
 * Fetch the full thread for a given threadId.
 */
export async function fetchThread(threadId) {
  if (!gmail) throw new Error('Gmail not initialized');

  const res = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'full',
  });

  const messages = (res.data.messages || []).map(parseGmailMessage);
  return messages;
}

/**
 * Mark an email as read.
 */
export async function markAsRead(messageId) {
  if (!gmail) throw new Error('Gmail not initialized');
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { removeLabelIds: ['UNREAD'] },
  });
}

/**
 * Create a draft reply to a given email.
 */
export async function createDraft(originalEmail, replyBody) {
  if (!gmail) throw new Error('Gmail not initialized');

  const rawMessage = buildReplyRaw(originalEmail, replyBody);

  const res = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: {
        raw: rawMessage,
        threadId: originalEmail.threadId,
      },
    },
  });

  logger.info(`Draft created: ${res.data.id} (thread: ${originalEmail.threadId})`);
  return res.data;
}

/**
 * Send a draft by its draftId (for human-approved sends).
 */
export async function sendDraft(draftId) {
  if (!gmail) throw new Error('Gmail not initialized');
  const res = await gmail.users.drafts.send({
    userId: 'me',
    requestBody: { id: draftId },
  });
  logger.info(`Draft sent: ${draftId}`);
  return res.data;
}

// ─── Internal Helpers ───────────────────────────────────────

function parseGmailMessage(msg) {
  const headers = msg.payload?.headers || [];
  const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  const bodyData = extractBody(msg.payload);
  const plainText = bodyData.plain
    ? Buffer.from(bodyData.plain, 'base64').toString('utf-8')
    : '';
  const htmlText = bodyData.html
    ? Buffer.from(bodyData.html, 'base64').toString('utf-8')
    : '';

  // Prefer plain text, fall back to converting sanitized HTML
  let body = plainText;
  if (!body && htmlText) {
    const sanitized = sanitizeHtml(htmlText, {
      allowedTags: [],
      allowedAttributes: {},
    });
    body = convert(sanitized, { wordwrap: 120 });
  }

  const attachments = extractAttachmentInfo(msg.payload);

  return {
    id: msg.id,
    threadId: msg.threadId,
    from: getHeader('From'),
    to: getHeader('To'),
    cc: getHeader('Cc'),
    subject: getHeader('Subject'),
    date: getHeader('Date'),
    body: body.trim(),
    snippet: msg.snippet || '',
    labelIds: msg.labelIds || [],
    attachments,
  };
}

function extractBody(payload) {
  const result = { plain: null, html: null };

  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    result.plain = payload.body.data;
  } else if (payload.mimeType === 'text/html' && payload.body?.data) {
    result.html = payload.body.data;
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested.plain) result.plain = nested.plain;
      if (nested.html) result.html = nested.html;
    }
  }

  return result;
}

function extractAttachmentInfo(payload) {
  const attachments = [];

  if (payload.filename && payload.body?.attachmentId) {
    attachments.push({
      filename: payload.filename,
      mimeType: payload.mimeType,
      size: payload.body.size,
      attachmentId: payload.body.attachmentId,
    });
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      attachments.push(...extractAttachmentInfo(part));
    }
  }

  return attachments;
}

function buildReplyRaw(originalEmail, replyBody) {
  const to = originalEmail.from;
  const subject = originalEmail.subject.startsWith('Re:')
    ? originalEmail.subject
    : `Re: ${originalEmail.subject}`;
  const inReplyTo = originalEmail.id;
  const references = originalEmail.id;

  const messageParts = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `In-Reply-To: ${inReplyTo}`,
    `References: ${references}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    '',
    replyBody,
  ];

  const message = messageParts.join('\r\n');
  return Buffer.from(message).toString('base64url');
}
