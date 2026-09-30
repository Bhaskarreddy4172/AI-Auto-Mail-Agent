import { ollamaChat } from '../llm/ollama.js';
import config from '../config.js';
import logger from '../logger.js';

const TONE_MAPPING = {
  customer_complaint: { style: 'empathetic', formality: 'professional', warmth: 'high' },
  customer_inquiry: { style: 'helpful', formality: 'professional', warmth: 'medium' },
  quotation_request: { style: 'clear', formality: 'business', warmth: 'medium' },
  follow_up: { style: 'responsive', formality: 'match-sender', warmth: 'medium' },
  support_request: { style: 'solution-oriented', formality: 'professional', warmth: 'high' },
  sales_inquiry: { style: 'enthusiastic', formality: 'business', warmth: 'high' },
  internal_communication: { style: 'direct', formality: 'casual', warmth: 'medium' },
  meeting_request: { style: 'accommodating', formality: 'professional', warmth: 'medium' },
  feedback: { style: 'grateful', formality: 'professional', warmth: 'high' },
  escalation: { style: 'urgent', formality: 'formal', warmth: 'medium' },
  other: { style: 'neutral', formality: 'professional', warmth: 'medium' },
};

/**
 * Determine the appropriate tone parameters for a reply.
 */
export function determineTone(classification, persona) {
  const baseTone = TONE_MAPPING[classification.intent] || TONE_MAPPING.other;

  // Adjust for urgency
  if (classification.urgency === 'critical') {
    baseTone.style = 'urgent and empathetic';
    baseTone.formality = 'formal';
  }

  // Adjust for sentiment
  if (classification.sentiment === 'angry') {
    baseTone.warmth = 'high';
    baseTone.style = 'calming and empathetic';
  }

  return {
    ...baseTone,
    personaToneRules: persona.toneRules,
  };
}

/**
 * Generate a tone instruction string for the reply LLM.
 */
export function buildToneInstructions(tone, persona) {
  const lines = [
    `Communication style: ${tone.style}`,
    `Formality level: ${tone.formality}`,
    `Warmth level: ${tone.warmth}`,
    '',
    'Persona-specific tone rules:',
    ...persona.toneRules.map(r => `- ${r}`),
    '',
    'CRITICAL HUMAN-LIKE REQUIREMENTS:',
    '- Do NOT sound like a generic chatbot or template',
    '- Vary sentence length naturally',
    '- Occasionally use contractions (don\'t, we\'re, etc.)',
    '- Avoid overly perfect grammar — an occasional casual phrasing is OK',
    '- Mirror the sender\'s communication style when appropriate',
    '- Never start with "I hope this email finds you well" or similar clichés',
    '- Do not use exclamation marks excessively',
  ];

  return lines.join('\n');
}
