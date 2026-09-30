import { initDatabase, runMigrations, addKnowledge, closeDatabase } from '../memory/database.js';
import { initVectorStore, storeKnowledge } from '../memory/vector-store.js';
import logger from '../logger.js';

/**
 * Setup script: creates database tables and seeds sample company knowledge.
 *
 * Usage: node src/scripts/setup-db.js
 */
async function setup() {
  logger.info('Setting up database...');

  // Init PostgreSQL
  initDatabase();
  await runMigrations();
  logger.info('Tables created.');

  // Seed sample company knowledge
  const knowledgeEntries = [
    {
      category: 'support',
      title: 'Refund Policy',
      content: 'We offer full refunds within 30 days of purchase for unused products. After 30 days, we offer store credit. Damaged items can be refunded within 90 days with proof of damage.',
      tags: ['refund', 'return', 'policy'],
    },
    {
      category: 'support',
      title: 'Response Time SLA',
      content: 'Critical issues: 1 hour response. High: 4 hours. Medium: 24 hours. Low: 48 hours. All business hours (9 AM - 6 PM local time).',
      tags: ['sla', 'response-time', 'support'],
    },
    {
      category: 'sales',
      title: 'Pricing Tiers',
      content: 'Starter: $29/mo (up to 5 users). Professional: $99/mo (up to 25 users). Enterprise: Custom pricing (25+ users). All plans include email support. Professional+ includes phone support.',
      tags: ['pricing', 'plans', 'tiers'],
    },
    {
      category: 'general',
      title: 'Company Overview',
      content: 'TechBott is a technology solutions company specializing in AI-powered automation tools for businesses. Founded in 2020. Headquarters in San Francisco. 150+ employees.',
      tags: ['company', 'about', 'overview'],
    },
    {
      category: 'support',
      title: 'Escalation Procedure',
      content: 'Level 1: Support agent handles. Level 2: Team lead review (if unresolved after 24h or customer requests). Level 3: Engineering (technical issues). Level 4: Management (complaints, legal).',
      tags: ['escalation', 'procedure', 'support'],
    },
  ];

  for (const entry of knowledgeEntries) {
    const id = await addKnowledge(entry.category, entry.title, entry.content, entry.tags);
    logger.info(`  Added knowledge: ${entry.title} (id=${id})`);

    // Also store in vector DB if available
    try {
      await initVectorStore();
      await storeKnowledge(id, entry.title, entry.content, entry.category);
    } catch (err) {
      logger.warn(`  Could not store in vector DB: ${err.message}`);
    }
  }

  logger.info('Setup complete.');
  await closeDatabase();
}

setup().catch((err) => {
  logger.error(`Setup failed: ${err.message}`);
  process.exit(1);
});
