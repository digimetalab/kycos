/**
 * @fileoverview KYCOS AI Router — multi-provider model selection.
 * Routes AI tasks to the optimal provider/model based on task type,
 * with automatic fallback through the provider chain.
 *
 * Routing table:
 *   narrative_synthesis  → claude-opus-4-5
 *   data_extraction      → gemini-2.0-flash
 *   pattern_matching     → gpt-4o (via OpenRouter)
 *   privacy_mode         → ollama (local)
 *   cost_sensitive       → claude-haiku-4-5
 */

import {
  claudeComplete,
  geminiComplete,
  openrouterComplete,
  ollamaComplete,
  isOllamaAvailable,
  parseJSON,
} from './ai-clients.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('AIRouter');

// ─── Route Configuration ──────────────────────────────────────

/** @type {Record<string, { provider: string, model: string }>} */
const ROUTES = {
  narrative_synthesis: { provider: 'claude',     model: 'claude-opus-4-5-20250415' },
  data_extraction:    { provider: 'gemini',     model: 'gemini-2.0-flash' },
  pattern_matching:   { provider: 'openrouter', model: 'openai/gpt-4o' },
  privacy_mode:       { provider: 'ollama',     model: 'llama3.1' },
  cost_sensitive:     { provider: 'claude',     model: 'claude-haiku-4-5-20250415' },
};

/** Fallback order when preferred provider fails */
const FALLBACK_ORDER = ['claude', 'gemini', 'openrouter', 'ollama'];

/** Provider → completion function map */
const COMPLETERS = {
  claude:     claudeComplete,
  gemini:     geminiComplete,
  openrouter: openrouterComplete,
  ollama:     ollamaComplete,
};

// ─── Public API ────────────────────────────────────────────────

/**
 * Check which providers have API keys configured.
 * @returns {Promise<string[]>} Available provider names
 */
export async function getAvailableProviders() {
  const available = [];
  if (process.env.ANTHROPIC_API_KEY) available.push('claude');
  if (process.env.GOOGLE_AI_API_KEY) available.push('gemini');
  if (process.env.OPENROUTER_API_KEY) available.push('openrouter');
  try { if (await isOllamaAvailable()) available.push('ollama'); } catch { /* skip */ }
  return available;
}

/**
 * Resolve the route config for a task type.
 * @param {string} taskType
 * @returns {{ provider: string, model: string }}
 */
export function resolveRoute(taskType) {
  const route = ROUTES[taskType];
  if (!route) {
    logger.warn(`Unknown task type "${taskType}", falling back to cost_sensitive`);
    return ROUTES.cost_sensitive;
  }
  return route;
}

/**
 * Route a completion request with automatic fallback.
 *
 * @param {Object} request
 * @param {string} request.taskType - Route key
 * @param {string} request.systemPrompt
 * @param {string} request.userMessage
 * @param {number} [request.maxTokens=4096]
 * @param {number} [request.temperature=0.3]
 * @param {boolean} [request.jsonMode=false]
 * @returns {Promise<{ content: string, provider: string, model: string, usage: Object }>}
 */
export async function routeCompletion(request) {
  const { taskType, systemPrompt, userMessage, maxTokens = 4096, temperature = 0.3, jsonMode = false } = request;
  const route = resolveRoute(taskType);
  const available = await getAvailableProviders();

  const tryOrder = [route.provider, ...FALLBACK_ORDER.filter(p => p !== route.provider)];
  const errors = [];

  for (const providerName of tryOrder) {
    if (!available.includes(providerName)) {
      logger.debug(`Skipping ${providerName} — not available`);
      continue;
    }

    const completeFn = COMPLETERS[providerName];
    if (!completeFn) continue;

    const model = providerName === route.provider ? route.model : undefined;

    try {
      logger.debug(`Routing "${taskType}" → ${providerName} (${model || 'default'})`);
      const result = await completeFn({ model, systemPrompt, userMessage, maxTokens, temperature, jsonMode });
      return { content: result.content, provider: providerName, model: result.model, usage: result.usage };
    } catch (err) {
      logger.warn(`${providerName} failed: ${err.message}`);
      errors.push({ provider: providerName, error: err.message });
    }
  }

  throw new Error(
    `All AI providers failed for task "${taskType}":\n` +
    errors.map(e => `  - ${e.provider}: ${e.error}`).join('\n')
  );
}

/**
 * Route a request and parse the response as JSON.
 * @param {Object} request - Same as routeCompletion, jsonMode forced true
 * @returns {Promise<{ data: Object, provider: string, model: string }>}
 */
export async function routeJSON(request) {
  const result = await routeCompletion({ ...request, jsonMode: true });

  try {
    const data = parseJSON(result.content);
    return { data, provider: result.provider, model: result.model };
  } catch (parseErr) {
    // Last resort: extract JSON object from response
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return { data: JSON.parse(jsonMatch[0]), provider: result.provider, model: result.model };
    }
    throw new Error(`Failed to parse JSON from ${result.provider}: ${parseErr.message}`);
  }
}
