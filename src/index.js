import config from './config.js';
import logger from './logger.js';
import { initEmail } from './email/adapter.js';
import { initDatabase, runMigrations } from './memory/database.js';
import { initVectorStore } from './memory/vector-store.js';
import { checkOllamaHealth } from './llm/ollama.js';
import { processNewEmails } from './agents/orchestrator.js';
import { processFollowUps } from './agents/follow-up-agent.js';
import { startServer } from './server/api.js';

let pollingInterval = null;

async function main() {
  logger.info('╔══════════════════════════════════════════╗');
  logger.info('║    Autonomous Email Agent – Starting     ║');
  logger.info(`║    Company: ${config.agent.companyName.padEnd(28)}║`);
  logger.info(`║    Draft-only mode: ${String(config.agent.draftOnlyMode).padEnd(20)}║`);
  logger.info('╚══════════════════════════════════════════╝');

  // 1. Check Ollama
  logger.info('Checking Ollama connection...');
  const ollamaStatus = await checkOllamaHealth();
  if (!ollamaStatus.healthy) {
    logger.error(`Ollama is not reachable: ${ollamaStatus.error}`);
    logger.error('Please start Ollama and pull the required models.');
    logger.error(`  ollama pull ${config.ollama.classificationModel}`);
    logger.error(`  ollama pull ${config.ollama.draftingModel}`);
    logger.error(`  ollama pull ${config.ollama.reasoningModel}`);
    process.exit(1);
  }

  // 2. Init PostgreSQL
  logger.info('Connecting to PostgreSQL...');
  try {
    initDatabase();
    await runMigrations();
  } catch (err) {
    logger.error(`PostgreSQL failed: ${err.message}`);
    logger.warn('Continuing without database — email logging will fail.');
  }

  // 3. Init ChromaDB
  logger.info('Connecting to ChromaDB...');
  try {
    await initVectorStore();
  } catch (err) {
    logger.error(`ChromaDB failed: ${err.message}`);
    logger.warn('Continuing without vector store — memory search will be limited.');
  }

  // 4. Init Email
  logger.info('Initializing email...');
  try {
    await initEmail();
  } catch (err) {
    logger.error(`Email init failed: ${err.message}`);
    if (config.emailMode === 'api') {
      logger.error('Run: GET http://localhost:3000/auth to set up OAuth');
    } else {
      logger.error('Check GMAIL_USER_EMAIL and GMAIL_APP_PASSWORD in .env');
    }
  }

  // 5. Start API server
  startServer();

  // 6. Start polling loop — lock is now in orchestrator.processNewEmails()
  const pollCycle = async () => {
    try {
      await processNewEmails();
    } catch (err) {
      logger.error(`Polling cycle error: ${err.message}`);
    }
  };

  logger.info(`Starting email polling (every ${config.agent.pollIntervalMs / 1000}s)...`);
  pollingInterval = setInterval(pollCycle, config.agent.pollIntervalMs);

  // Run immediately on start
  await pollCycle();

  // 7. Start Follow-Up Agent Loop (runs once every 24 hours)
  const followUpCycle = async () => {
    try {
      await processFollowUps();
    } catch (err) {
      logger.error(`Follow-up cycle error: ${err.message}`);
    }
  };
  
  const FOLLOW_UP_INTERVAL = 24 * 60 * 60 * 1000;
  logger.info('Starting daily follow-up polling...');
  setInterval(followUpCycle, FOLLOW_UP_INTERVAL);
  
  // Optionally run once on start (commented out to avoid immediate spam on restart)
  // await followUpCycle();
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  if (pollingInterval) clearInterval(pollingInterval);
  const { closeDatabase } = await import('./memory/database.js');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down...');
  if (pollingInterval) clearInterval(pollingInterval);
  const { closeDatabase } = await import('./memory/database.js');
  await closeDatabase();
  process.exit(0);
});

main().catch((err) => {
  logger.error(`Fatal error: ${err.message}`, { stack: err.stack });
  process.exit(1);
});
