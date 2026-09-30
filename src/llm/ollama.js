import config from '../config.js';
import logger from '../logger.js';

/**
 * Calls the Ollama REST API for chat completions.
 */
export async function ollamaChat(model, systemPrompt, userMessage, options = {}) {
  const url = `${config.ollama.baseUrl}/api/chat`;

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    stream: false,
    options: {
      temperature: options.temperature ?? 0.7,
      num_predict: options.maxTokens ?? 2048,
      repeat_penalty: options.repeat_penalty ?? 1.1,
    },
  };

  const timeoutMs = options.timeoutMs ?? 120_000; // 2 min default
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error(`Ollama chat timed out after ${timeoutMs / 1000}s`);
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama API error (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.message?.content?.trim() || '';
}

/**
 * Generate embeddings via Ollama.
 */
export async function ollamaEmbed(model, text) {
  const url = `${config.ollama.baseUrl}/api/embeddings`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Ollama embed timed out after 60s');
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Ollama embed error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.embedding;
}

/**
 * Check if Ollama is reachable and a model is available.
 */
export async function checkOllamaHealth() {
  try {
    const res = await fetch(`${config.ollama.baseUrl}/api/tags`);
    if (!res.ok) return { healthy: false, error: `Status ${res.status}` };
    const data = await res.json();
    const modelNames = (data.models || []).map(m => m.name);
    logger.info(`Ollama models available: ${modelNames.join(', ') || 'none'}`);
    return { healthy: true, models: modelNames };
  } catch (err) {
    return { healthy: false, error: err.message };
  }
}
