import 'dotenv/config';

const config = {
  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    redirectUri: process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/auth/callback',
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
    userEmail: process.env.GMAIL_USER_EMAIL,
    appPassword: process.env.GMAIL_APP_PASSWORD,
  },
  emailMode: process.env.EMAIL_MODE || 'api',  // 'api' = Gmail API OAuth2, 'imap' = IMAP/SMTP with app password
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    reasoningModel: process.env.OLLAMA_REASONING_MODEL || 'qwen2.5:14b',
    draftingModel: process.env.OLLAMA_DRAFTING_MODEL || 'mistral:7b',
    classificationModel: process.env.OLLAMA_CLASSIFICATION_MODEL || 'phi3:mini',
  },
  pg: {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432', 10),
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE || 'email_agent',
  },
  chroma: {
    url: process.env.CHROMA_URL || 'http://localhost:8000',
    collection: process.env.CHROMA_COLLECTION || 'email_memory',
  },
  agent: {
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '30000', 10),
    draftOnlyMode: process.env.DRAFT_ONLY_MODE !== 'false',
    defaultPersona: process.env.DEFAULT_PERSONA || 'support',
    companyName: process.env.COMPANY_NAME || 'TechBott',
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
  },
  logLevel: process.env.LOG_LEVEL || 'info',
};

export default config;
