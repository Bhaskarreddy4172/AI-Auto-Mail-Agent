import { ollamaChat } from '../llm/ollama.js';
import config from '../config.js';
import logger from '../logger.js';

const POLICY_RULES = [
  {
    name: 'sensitive_data',
    description: 'Reply must not contain passwords, API keys, SSNs, credit card numbers, or internal credentials',
    patterns: [
      /\b\d{3}-\d{2}-\d{4}\b/,                 // SSN
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card
      /password\s*[:=]\s*\S+/i,
      /api[_-]?key\s*[:=]\s*\S+/i,
      /secret\s*[:=]\s*\S+/i,
      /bearer\s+[a-zA-Z0-9._-]+/i,
    ],
  },
  {
    name: 'pricing_commitment',
    description: 'Reply must not make unauthorized pricing commitments or discounts',
    keywords: ['discount', 'free', 'waive', 'refund', 'credit', 'special price', 'complimentary'],
  },
  {
    name: 'legal_risk',
    description: 'Reply must not make legally binding statements or admissions of fault',
    keywords: ['we admit', 'our fault', 'liable', 'guarantee', 'legally', 'lawsuit', 'we promise', 'binding'],
  },
  {
    name: 'escalation_needed',
    description: 'Some situations require human handling, not AI replies',
    keywords: ['legal notice', 'attorney', 'subpoena', 'court order', 'cease and desist', 'regulatory'],
  },
];

/**
 * Check a draft reply against safety policies.
 * @param {string} draftText - The generated reply text
 * @param {object} classification - Email classification
 * @returns {{ safe: boolean, violations: Array<{rule: string, detail: string}> }}
 */
export function checkPolicy(draftText, classification) {
  const violations = [];
  const lowerDraft = draftText.toLowerCase();

  for (const rule of POLICY_RULES) {
    // Check regex patterns
    if (rule.patterns) {
      for (const pattern of rule.patterns) {
        if (pattern.test(draftText)) {
          violations.push({
            rule: rule.name,
            detail: `Draft may contain ${rule.description.toLowerCase()}`,
          });
          break;
        }
      }
    }

    // Check keyword presence
    if (rule.keywords) {
      const found = rule.keywords.filter(kw => lowerDraft.includes(kw.toLowerCase()));
      if (found.length > 0) {
        violations.push({
          rule: rule.name,
          detail: `Draft contains flagged terms: ${found.join(', ')}. ${rule.description}`,
        });
      }
    }
  }

  // Auto-escalate if classification says so
  if (classification.requiresEscalation) {
    violations.push({
      rule: 'escalation_flag',
      detail: 'Email was flagged for human escalation during classification',
    });
  }

  const safe = violations.length === 0;

  if (!safe) {
    logger.warn(`Policy check found ${violations.length} violation(s): ${violations.map(v => v.rule).join(', ')}`);
  } else {
    logger.info('Policy check passed');
  }

  return { safe, violations };
}

/**
 * Run an LLM-powered deep policy review for edge cases.
 */
export async function deepPolicyReview(draftText, email, classification) {
  const systemPrompt = `You are a compliance reviewer for ${config.agent.companyName}.

Review this draft email reply for any issues:
1. Does it contain sensitive data (passwords, personal info, financial data)?
2. Does it make unauthorized commitments (pricing, legal, timelines)?
3. Does it need escalation to a human?
4. Is the tone appropriate for the situation?

Return JSON:
{
  "approved": true/false,
  "issues": ["list of issues if any"],
  "riskLevel": "none" | "low" | "medium" | "high"
}

Return ONLY valid JSON.`;

  const userMessage = `Original email subject: ${email.subject}
Original email from: ${email.from}
Classification: ${classification.intent} (urgency: ${classification.urgency})

Draft reply:
${draftText}`;

  try {
    const raw = await ollamaChat(
      config.ollama.reasoningModel,
      systemPrompt,
      userMessage,
      { temperature: 0.1, maxTokens: 512 }
    );
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    logger.error(`Deep policy review failed: ${err.message}`);
    return { approved: false, issues: ['Deep review failed — manual review required'], riskLevel: 'high' };
  }
}
