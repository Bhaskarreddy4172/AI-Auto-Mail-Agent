import Imap from 'imap';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import config from '../config.js';
import logger from '../logger.js';

const IMAP_CONFIG = {
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  tlsOptions: { servername: 'imap.gmail.com' },
};

function createImapConnection() {
  return new Imap({
    user: config.gmail.userEmail,
    password: config.gmail.appPassword,
    ...IMAP_CONFIG,
  });
}

let transporter = null;

/**
 * Initialize the SMTP transporter for sending/drafting.
 */
export function initSmtp() {
  const { userEmail, appPassword } = config.gmail;

  if (!userEmail || !appPassword) {
    throw new Error('Set GMAIL_USER_EMAIL and GMAIL_APP_PASSWORD in .env');
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: userEmail,
      pass: appPassword,
    },
  });

  logger.info(`SMTP transport initialized for ${userEmail}`);
}

/**
 * Fetch unread emails via IMAP.
 */
export function fetchUnreadEmails(maxResults = 10) {
  return new Promise((resolve, reject) => {
    const imap = createImapConnection();

    const emails = [];

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err) => {
        if (err) { imap.end(); return reject(err); }

        imap.search(['UNSEEN'], (err, uids) => {
          if (err) { imap.end(); return reject(err); }

          if (!uids || uids.length === 0) {
            logger.info('No unread emails found (IMAP)');
            imap.end();
            return resolve([]);
          }

          const subset = uids.slice(-maxResults);
          logger.info(`Found ${uids.length} unread email(s), fetching ${subset.length}`);

          const fetcher = imap.fetch(subset, {
            bodies: '',
            struct: true,
            markSeen: false,
          });

          fetcher.on('message', (msg, seqno) => {
            let uid = null;
            const chunks = [];

            msg.on('attributes', (attrs) => {
              uid = attrs.uid;
            });

            msg.on('body', (stream) => {
              stream.on('data', (chunk) => chunks.push(chunk));
            });

            msg.once('end', async () => {
              try {
                const raw = Buffer.concat(chunks);
                const parsed = await simpleParser(raw);

                emails.push({
                  id: String(uid),
                  threadId: parsed.messageId || String(uid),
                  from: parsed.from?.text || '',
                  to: parsed.to?.text || '',
                  cc: parsed.cc?.text || '',
                  subject: parsed.subject || '(no subject)',
                  date: parsed.date?.toISOString() || new Date().toISOString(),
                  body: (parsed.text || '').trim(),
                  snippet: (parsed.text || '').slice(0, 200),
                  labelIds: [],
                  attachments: (parsed.attachments || []).map(a => ({
                    filename: a.filename,
                    mimeType: a.contentType,
                    size: a.size,
                  })),
                  messageId: parsed.messageId || '',
                  inReplyTo: parsed.inReplyTo || '',
                  references: parsed.references || [],
                  _uid: uid,
                });
              } catch (parseErr) {
                logger.error(`Failed to parse message seqno=${seqno}: ${parseErr.message}`);
              }
            });
          });

          fetcher.once('error', (err) => {
            logger.error(`IMAP fetch error: ${err.message}`);
          });

          fetcher.once('end', () => {
            imap.end();
          });
        });
      });
    });

    imap.once('error', (err) => {
      reject(new Error(`IMAP connection error: ${err.message}`));
    });

    imap.once('end', () => {
      resolve(emails);
    });

    imap.connect();
  });
}

/**
 * Fetch recent emails (read + unread) via IMAP.
 */
export function fetchRecentEmails(maxResults = 10) {
  return new Promise((resolve, reject) => {
    const imap = createImapConnection();
    const emails = [];

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err) => {
        if (err) { imap.end(); return reject(err); }

        // Search ALL emails, take the most recent N
        imap.search(['ALL'], (err, uids) => {
          if (err) { imap.end(); return reject(err); }

          if (!uids || uids.length === 0) {
            logger.info('No emails found in inbox (IMAP)');
            imap.end();
            return resolve([]);
          }

          const subset = uids.slice(-maxResults);
          logger.info(`Found ${uids.length} total email(s), fetching last ${subset.length}`);

          const fetcher = imap.fetch(subset, {
            bodies: '',
            struct: true,
            markSeen: false,
          });

          fetcher.on('message', (msg, seqno) => {
            let uid = null;
            const chunks = [];

            msg.on('attributes', (attrs) => { uid = attrs.uid; });
            msg.on('body', (stream) => { stream.on('data', (chunk) => chunks.push(chunk)); });

            msg.once('end', async () => {
              try {
                const raw = Buffer.concat(chunks);
                const parsed = await simpleParser(raw);
                emails.push({
                  id: String(uid),
                  threadId: parsed.messageId || String(uid),
                  from: parsed.from?.text || '',
                  to: parsed.to?.text || '',
                  cc: parsed.cc?.text || '',
                  subject: parsed.subject || '(no subject)',
                  date: parsed.date?.toISOString() || new Date().toISOString(),
                  body: (parsed.text || '').trim(),
                  snippet: (parsed.text || '').slice(0, 200),
                  labelIds: [],
                  attachments: (parsed.attachments || []).map(a => ({
                    filename: a.filename, mimeType: a.contentType, size: a.size,
                  })),
                  messageId: parsed.messageId || '',
                  inReplyTo: parsed.inReplyTo || '',
                  references: parsed.references || [],
                  _uid: uid,
                });
              } catch (parseErr) {
                logger.error(`Failed to parse message seqno=${seqno}: ${parseErr.message}`);
              }
            });
          });

          fetcher.once('error', (err) => { logger.error(`IMAP fetch error: ${err.message}`); });
          fetcher.once('end', () => { imap.end(); });
        });
      });
    });

    imap.once('error', (err) => { reject(new Error(`IMAP connection error: ${err.message}`)); });
    imap.once('end', () => { resolve(emails); });
    imap.connect();
  });
}

/**
 * Mark an email as read (set \Seen flag) via IMAP.
 */
export function markAsRead(uid) {
  return new Promise((resolve, reject) => {
    const numericUid = Number(uid);
    if (!numericUid || isNaN(numericUid)) {
      return reject(new Error(`Invalid UID for markAsRead: ${uid}`));
    }
    const imap = createImapConnection();

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err) => {
        if (err) { imap.end(); return reject(err); }

        imap.addFlags(numericUid, ['\\Seen'], (err) => {
          imap.end();
          if (err) return reject(err);
          logger.info(`Marked uid=${numericUid} as read`);
          resolve();
        });
      });
    });

    imap.once('error', reject);
    imap.connect();
  });
}

/**
 * Fetch thread (previous messages with same subject or references).
 */
export async function fetchThread(threadId) {
  // For IMAP, threadId is the messageId — we search by References/In-Reply-To
  // Simplified: return empty for now, context engine handles gracefully
  return [];
}

/**
 * Create a draft reply by saving to Gmail Drafts folder via IMAP APPEND.
 */
export function createDraft(originalEmail, replyBody) {
  return new Promise((resolve, reject) => {
    const to = originalEmail.from;
    const subject = originalEmail.subject.startsWith('Re:')
      ? originalEmail.subject
      : `Re: ${originalEmail.subject}`;

    const messageParts = [
      `From: ${config.gmail.userEmail}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `In-Reply-To: ${originalEmail.messageId || ''}`,
      `References: ${originalEmail.messageId || ''}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'MIME-Version: 1.0',
      '',
      replyBody,
    ];

    const rawMessage = messageParts.join('\r\n');

    const imap = createImapConnection();

    imap.once('ready', () => {
      // Gmail's Drafts folder
      imap.append(rawMessage, { mailbox: '[Gmail]/Drafts', flags: ['\\Draft'] }, (err) => {
        imap.end();
        if (err) return reject(err);
        const draftId = `draft-${Date.now()}`;
        logger.info(`Draft saved to [Gmail]/Drafts (${draftId})`);
        resolve({ id: draftId, threadId: originalEmail.threadId });
      });
    });

    imap.once('error', reject);
    imap.connect();
  });
}

/**
 * Send an email directly via SMTP (only if draft-only mode is disabled).
 */
export async function sendEmail(to, subject, body, attachments = []) {
  if (!transporter) throw new Error('SMTP not initialized. Call initSmtp() first.');

  const result = await transporter.sendMail({
    from: config.gmail.userEmail,
    to,
    subject,
    text: body,
    attachments
  });

  logger.info(`Email sent: ${result.messageId}`);
  return result;
}
