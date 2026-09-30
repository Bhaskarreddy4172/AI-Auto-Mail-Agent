import pg from 'pg';
import config from '../config.js';
import logger from '../logger.js';

const { Pool } = pg;

let pool = null;

/**
 * Initialize the PostgreSQL connection pool.
 */
export function initDatabase() {
  pool = new Pool({
    host: config.pg.host,
    port: config.pg.port,
    user: config.pg.user,
    password: config.pg.password,
    database: config.pg.database,
    max: 10,
    idleTimeoutMillis: 30000,
  });

  pool.on('error', (err) => {
    logger.error(`PostgreSQL pool error: ${err.message}`);
  });

  logger.info('PostgreSQL pool initialized');
}

/**
 * Run the initial schema migration.
 */
export async function runMigrations() {
  if (!pool) throw new Error('Database not initialized');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_log (
      id SERIAL PRIMARY KEY,
      message_id TEXT UNIQUE NOT NULL,
      thread_id TEXT,
      sender TEXT NOT NULL,
      subject TEXT,
      intent TEXT,
      urgency TEXT,
      sentiment TEXT,
      persona_used TEXT,
      draft_id TEXT,
      status TEXT DEFAULT 'drafted',
      policy_safe BOOLEAN DEFAULT true,
      policy_violations JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS customer_profiles (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      sender_type TEXT DEFAULT 'unknown',
      interaction_count INTEGER DEFAULT 0,
      last_interaction TIMESTAMPTZ,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS company_knowledge (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT[] DEFAULT '{}',
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_email_log_sender ON email_log(sender);
    CREATE INDEX IF NOT EXISTS idx_email_log_thread ON email_log(thread_id);
    CREATE INDEX IF NOT EXISTS idx_customer_profiles_email ON customer_profiles(email);
  `);

  logger.info('Database migrations complete');
}

/**
 * Log a processed email.
 */
export async function logEmail(data) {
  if (!pool) {
    logger.warn('Database not available — skipping email log');
    return null;
  }

  try {
    const result = await pool.query(
    `INSERT INTO email_log (message_id, thread_id, sender, subject, intent, urgency, sentiment, persona_used, draft_id, status, policy_safe, policy_violations)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (message_id) DO UPDATE SET
       draft_id = EXCLUDED.draft_id,
       status = EXCLUDED.status,
       policy_safe = EXCLUDED.policy_safe,
       policy_violations = EXCLUDED.policy_violations,
       updated_at = NOW()
     RETURNING id`,
    [
      data.messageId,
      data.threadId,
      data.sender,
      data.subject,
      data.intent,
      data.urgency,
      data.sentiment,
      data.personaUsed,
      data.draftId,
      data.status || 'drafted',
      data.policySafe ?? true,
      JSON.stringify(data.policyViolations || []),
    ]
  );

    return result.rows[0].id;
  } catch (err) {
    logger.warn(`Failed to log email: ${err.message}`);
    return null;
  }
}

/**
 * Get customer interaction history by email address.
 */
export async function getCustomerHistory(email) {
  if (!pool) return null;

  // Upsert customer profile
  await pool.query(
    `INSERT INTO customer_profiles (email, interaction_count, last_interaction)
     VALUES ($1, 1, NOW())
     ON CONFLICT (email) DO UPDATE SET
       interaction_count = customer_profiles.interaction_count + 1,
       last_interaction = NOW(),
       updated_at = NOW()`,
    [email]
  );

  // Fetch profile
  const profile = await pool.query(
    'SELECT * FROM customer_profiles WHERE email = $1',
    [email]
  );

  // Fetch recent email log entries
  const recentEmails = await pool.query(
    `SELECT subject, intent, urgency, status, created_at
     FROM email_log WHERE sender = $1
     ORDER BY created_at DESC LIMIT 10`,
    [email]
  );

  return {
    profile: profile.rows[0] || null,
    recentInteractions: recentEmails.rows,
  };
}

/**
 * Get emails that need follow-up (quotation_request or sales_inquiry) older than a specified number of days,
 * where the deal is not marked as closed.
 */
export async function getPendingFollowUps(daysOld = 3) {
  if (!pool) return [];
  
  // We'll consider a deal open if the status is not 'closed' and not 'escalated'
  const result = await pool.query(
    `SELECT * FROM email_log 
     WHERE intent IN ('quotation_request', 'sales_inquiry') 
     AND status NOT IN ('closed', 'escalated')
     AND created_at < NOW() - INTERVAL '$1 days'
     ORDER BY created_at ASC`,
    [daysOld]
  );
  
  return result.rows;
}

/**
 * Update email log status (e.g., from 'drafted' to 'sent' or 'escalated').
 */
export async function updateEmailStatus(messageId, status) {
  if (!pool) return;
  try {
    await pool.query(
      'UPDATE email_log SET status = $1, updated_at = NOW() WHERE message_id = $2',
      [status, messageId]
    );
  } catch (err) {
    logger.warn(`Failed to update email status: ${err.message}`);
  }
}

/**
 * Add company knowledge entry.
 */
export async function addKnowledge(category, title, content, tags = []) {
  if (!pool) throw new Error('Database not initialized');
  const result = await pool.query(
    `INSERT INTO company_knowledge (category, title, content, tags)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [category, title, content, tags]
  );
  return result.rows[0].id;
}

/**
 * Search company knowledge by keywords.
 */
export async function searchKnowledge(query) {
  if (!pool) return [];
  const result = await pool.query(
    `SELECT id, category, title, content, tags FROM company_knowledge
     WHERE active = true AND (
       title ILIKE $1 OR content ILIKE $1 OR $2 = ANY(tags)
     ) LIMIT 10`,
    [`%${query}%`, query.toLowerCase()]
  );
  return result.rows;
}

/**
 * Get database stats for monitoring.
 */
export async function getStats() {
  if (!pool) return null;
  const emails = await pool.query('SELECT COUNT(*) as total, COUNT(CASE WHEN status = \'drafted\' THEN 1 END) as drafted, COUNT(CASE WHEN status = \'sent\' THEN 1 END) as sent, COUNT(CASE WHEN status = \'escalated\' THEN 1 END) as escalated FROM email_log');
  const customers = await pool.query('SELECT COUNT(*) as total FROM customer_profiles');
  return {
    emails: emails.rows[0],
    customers: customers.rows[0].total,
  };
}

export async function closeDatabase() {
  if (pool) {
    await pool.end();
    logger.info('PostgreSQL pool closed');
  }
}
