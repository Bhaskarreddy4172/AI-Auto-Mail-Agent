# AI Auto Mail Agent 🤖📧

An autonomous, multi-agent AI system designed for intelligent email processing, categorization, context-aware reply generation, automated quoting, and proactive follow-ups. Built with local LLMs via Ollama, ChromaDB for semantic memory, PostgreSQL for relational storage, and support for Gmail API / IMAP & SMTP.

---

## ✨ Features

- **Multi-Agent Pipeline**:
  - **Orchestrator**: Coordinates email polling, processing lifecycle, and lock management.
  - **Intent Classifier**: Automatically detects email intent (inquiries, support, pricing, complaints, etc.).
  - **Reply Generator & Tone Engine**: Drafts professional, persona-aligned responses tailored to context and sentiment.
  - **Policy & Safety Checker**: Validates draft replies against business rules and compliance guidelines before sending or saving.
  - **Quote Generator**: Generates formal pricing quotes and exports them directly into PDF format.
  - **Follow-Up Agent**: Tracks thread status and schedules automated, contextual follow-ups.
  - **Product Knowledge & Offers**: Context-injected product catalog, live inventory, and active promotional offers.
- **Local & Private LLM Inference**: Powered by [Ollama](https://ollama.com/) with specialized models for classification (`phi3:mini`), drafting (`mistral:7b`), and complex reasoning (`qwen2.5:14b`).
- **Hybrid Memory**:
  - **Vector Store (ChromaDB)**: Long-term semantic retrieval across past conversations.
  - **Relational DB (PostgreSQL)**: Audit trail, thread state, and interaction history.
- **Dual Email Connectivity**:
  - **Gmail API**: OAuth2 authentication.
  - **IMAP / SMTP**: Standard credentials or Google App Passwords.
- **Safety First (Draft-Only Mode)**: Supports review workflows where responses are saved as drafts without auto-sending.
- **Monitoring Web Dashboard & API**: Express REST endpoints and embedded web UI (`public/index.html`) for live status inspection and monitoring.

---

## 🏗️ Architecture

```
                 Incoming Emails (Gmail API / IMAP)
                                │
                                ▼
                       ┌──────────────────┐
                       │   Orchestrator   │
                       └────────┬─────────┘
                                │
        ┌───────────────────────┼────────────────────────┐
        ▼                       ▼                        ▼
┌───────────────┐       ┌───────────────┐       ┌─────────────────┐
│ Intent Engine │       │ Context & RAG │       │ Tone & Persona  │
│  (phi3:mini)  │       │   (ChromaDB)  │       │     Engine      │
└───────┬───────┘       └───────┬───────┘       └────────┬────────┘
        │                       │                        │
        └───────────────────────┼────────────────────────┘
                                ▼
                    ┌────────────────────────┐
                    │ Reply/Quote Generator  │
                    │      (mistral/pdf)     │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │     Policy Checker     │
                    │      (Safety gate)     │
                    └───────────┬────────────┘
                                │
                                ▼
                Dispatch Email / Save Draft (SMTP / Gmail)
                                │
                                ▼
                    Audit Log in PostgreSQL
```

---

## 📋 Prerequisites

1. **Node.js**: v18+ (tested on v24+)
2. **Ollama**: Running locally at `http://localhost:11434`
   - Required models:
     ```bash
     ollama pull phi3:mini
     ollama pull mistral:7b
     ollama pull qwen2.5:14b
     ```
3. **PostgreSQL**: Running on port `5432`
4. **ChromaDB**: Running on port `8000`

---

## 🚀 Quick Start

### 1. Clone Repository & Install Dependencies

```bash
git clone https://github.com/Bhaskarreddy4172/AI-Auto-Mail-Agent.git
cd AI-Auto-Mail-Agent
npm install
```

### 2. Configure Environment

Copy the `.env.example` file to `.env` and fill in your settings:

```bash
cp .env.example .env
```

Key configurations:
- `EMAIL_MODE`: Set to `api` (Gmail OAuth) or `imap` (IMAP/SMTP with App Password).
- `DRAFT_ONLY_MODE`: Set to `true` for draft creation or `false` for automatic dispatch.
- `POLL_INTERVAL_MS`: Polling interval in milliseconds (default: `30000`).

### 3. Initialize Database

Run the database migration script:

```bash
npm run setup:db
```

### 4. Start the Agent

```bash
npm start
```

The server will start at `http://localhost:3000` with the live web UI available at `http://localhost:3000/`.

---

## 🔒 Security & Privacy

- Sensitive tokens and passwords are kept in `.env` and excluded from source control via `.gitignore`.
- LLM inference runs locally via Ollama, ensuring proprietary email communications remain secure and on-premise.

---

## 📄 License

ISC License / MIT License
