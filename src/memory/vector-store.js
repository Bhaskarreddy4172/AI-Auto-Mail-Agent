import { ChromaClient } from 'chromadb';
import { ollamaEmbed } from '../llm/ollama.js';
import config from '../config.js';
import logger from '../logger.js';

let client = null;
let collection = null;

/**
 * Initialize the ChromaDB client and collection.
 */
export async function initVectorStore() {
  client = new ChromaClient({ path: config.chroma.url });
  collection = await client.getOrCreateCollection({
    name: config.chroma.collection,
    metadata: { 'hnsw:space': 'cosine' },
  });
  logger.info(`ChromaDB collection "${config.chroma.collection}" ready`);
}

/**
 * Store a document in the vector store with its embedding.
 */
export async function storeMemory(id, document, metadata = {}) {
  if (!collection) throw new Error('Vector store not initialized');

  const embedding = await ollamaEmbed(config.ollama.draftingModel, document);

  await collection.add({
    ids: [id],
    documents: [document],
    embeddings: [embedding],
    metadatas: [metadata],
  });

  logger.debug(`Stored memory: ${id}`);
}

/**
 * Search the vector store for relevant documents.
 */
export async function searchMemory(query, nResults = 5) {
  if (!collection) {
    logger.warn('Vector store not initialized, returning empty results');
    return [];
  }

  const queryEmbedding = await ollamaEmbed(config.ollama.draftingModel, query);

  const results = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults,
  });

  if (!results.documents?.[0]) return [];

  return results.documents[0].map((doc, i) => ({
    document: doc,
    metadata: results.metadatas?.[0]?.[i] || {},
    distance: results.distances?.[0]?.[i] || null,
  }));
}

/**
 * Store an email thread summary for future context.
 */
export async function storeEmailMemory(email, classification, replyText) {
  const document = `Subject: ${email.subject}
From: ${email.from}
Type: ${classification.intent}
Summary: ${classification.summary}
Reply sent: ${replyText.slice(0, 500)}`;

  await storeMemory(
    `email-${email.id}`,
    document,
    {
      type: 'email_interaction',
      sender: email.from,
      intent: classification.intent,
      date: email.date,
    }
  );
}

/**
 * Store company knowledge document for retrieval.
 */
export async function storeKnowledge(id, title, content, category) {
  const document = `[${category}] ${title}\n${content}`;
  await storeMemory(
    `knowledge-${id}`,
    document,
    { type: 'company_knowledge', category, title }
  );
}
