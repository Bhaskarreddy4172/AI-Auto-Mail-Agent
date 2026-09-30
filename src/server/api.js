import express from 'express';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
import config from '../config.js';
import logger from '../logger.js';
import { getAuthUrl, exchangeCode } from '../email/adapter.js';
import { processNewEmails, processRecentEmails, processEmail, getActivityLog } from '../agents/orchestrator.js';
import { getStats } from '../memory/database.js';
import { listPersonas, getPersona } from '../agents/personas.js';
import { searchProducts, getAllProductsText, COMPANY_INFO, PRODUCTS } from '../agents/product-knowledge.js';
import { checkOllamaHealth } from '../llm/ollama.js';

const app = express();
app.use(express.json());

// ─── Health ────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', draftOnlyMode: config.agent.draftOnlyMode });
});

// ─── Dashboard ─────────────────────────────────────────────
const dashboardPath = join(process.cwd(), 'public', 'index.html');
app.get('/', (_req, res) => {
  if (existsSync(dashboardPath)) {
    res.setHeader('Content-Type', 'text/html');
    res.send(readFileSync(dashboardPath, 'utf-8'));
  } else {
    res.status(404).json({ error: 'Dashboard not found at ' + dashboardPath });
  }
});

// ─── OAuth2 Flow ───────────────────────────────────────────
app.get('/auth', (_req, res) => {
  const url = getAuthUrl();
  res.redirect(url);
});

app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'Missing authorization code' });

  try {
    const tokens = await exchangeCode(code);
    logger.info('OAuth tokens obtained. Save the refresh_token to .env:');
    // Only show non-sensitive confirmation; refresh token logged server-side only
    logger.info(`Refresh token: ${tokens.refresh_token}`);
    res.json({
      message: 'Authorization successful. Check server logs for the refresh token.',
      scopes: tokens.scope,
    });
  } catch (err) {
    logger.error(`OAuth exchange failed: ${err.message}`);
    res.status(500).json({ error: 'Token exchange failed' });
  }
});

// ─── Manual Trigger ────────────────────────────────────────
app.post('/process', async (_req, res) => {
  try {
    const results = await processNewEmails();
    res.json({ processed: results.length, results });
  } catch (err) {
    logger.error(`Manual process failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.post('/process/recent', async (req, res) => {
  const count = Math.min(parseInt(req.query.count) || 5, 20);
  try {
    const results = await processRecentEmails(count);
    res.json({ processed: results.length, results });
  } catch (err) {
    logger.error(`Recent reprocess failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── Stats ─────────────────────────────────────────────────
app.get('/stats', async (_req, res) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Personas ──────────────────────────────────────────────
app.get('/personas', (_req, res) => {
  const names = listPersonas();
  const details = names.map(n => {
    const p = getPersona(n);
    return { name: p.name, description: p.description, toneRules: p.toneRules };
  });
  res.json(details);
});

// ─── Dashboard API ─────────────────────────────────────────
app.get('/api/activity', (_req, res) => {
  res.json(getActivityLog());
});

app.get('/api/products', (_req, res) => {
  res.json({ company: COMPANY_INFO, products: PRODUCTS });
});

app.get('/api/products/search', (req, res) => {
  const q = req.query.q || '';
  if (!q) return res.json([]);
  const results = searchProducts(q);
  res.json(results.slice(0, 10));
});

app.get('/api/system', async (_req, res) => {
  const ollama = await checkOllamaHealth();
  res.json({
    company: config.agent.companyName,
    draftOnlyMode: config.agent.draftOnlyMode,
    emailMode: config.emailMode,
    pollInterval: config.agent.pollIntervalMs,
    models: {
      classification: config.ollama.classificationModel,
      drafting: config.ollama.draftingModel,
      reasoning: config.ollama.reasoningModel,
    },
    ollama,
  });
});

// ─── Start Server ──────────────────────────────────────────
export function startServer() {
  app.listen(config.server.port, () => {
    logger.info(`API server listening on http://localhost:${config.server.port}`);
    logger.info(`  GET  /health       - Health check`);
    logger.info(`  GET  /auth         - Start Gmail OAuth flow`);
    logger.info(`  POST /process      - Manually trigger email processing`);
    logger.info(`  GET  /stats        - View processing stats`);
    logger.info(`  GET  /personas     - List available personas`);
  });
}
