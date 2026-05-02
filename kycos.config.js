/**
 * @fileoverview KYCOS global configuration defaults.
 * These values are overridden by environment variables and CLI flags.
 */

/** @type {import('../src/core/ai-router.js').RoutingConfig} */
export const routingConfig = {
  routes: {
    narrative_synthesis:  { provider: 'claude',      model: 'claude-opus-4-5-20250415' },
    data_extraction:     { provider: 'gemini',      model: 'gemini-2.0-flash' },
    pattern_matching:    { provider: 'openrouter',  model: 'openai/gpt-4o' },
    privacy_mode:        { provider: 'ollama',      model: 'llama3.1' },
    cost_sensitive:      { provider: 'claude',      model: 'claude-haiku-4-5-20250415' },
  },
  fallbackOrder: ['claude', 'gemini', 'openrouter', 'ollama'],
  maxRetries: 2,
  timeoutMs: 60_000,
};

/** @type {Object} */
export const investigationModes = {
  quick:     { agents: ['identity', 'legal', 'risk'],                          maxMinutes: 2  },
  standard:  { agents: ['identity', 'social', 'legal', 'digital', 'risk'],     maxMinutes: 5  },
  deep:      { agents: ['identity', 'social', 'financial', 'legal', 'digital', 'network', 'risk'], maxMinutes: 15 },
  'full-aml': { agents: ['identity', 'social', 'financial', 'legal', 'digital', 'network', 'risk'], maxMinutes: 30 },
  credit:    { agents: ['identity', 'financial', 'legal', 'network', 'risk'],  maxMinutes: 10 },
};

/** @type {Object} */
export const cacheConfig = {
  enabled: true,
  ttlHours: 24,
  maxSizeMb: 500,
  dbPath: './data/cache.db',
};

/** @type {Object} */
export const scrapingConfig = {
  rateLimitMs: 1000,
  maxConcurrent: 3,
  userAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  ],
  timeout: 30_000,
};

/** @type {Object} */
export const reportConfig = {
  outputDir: './output',
  defaultFormat: 'pdf',
  companyName: 'KYCOS Intelligence',
  templateDir: './src/report/templates',
};

export default {
  routingConfig,
  investigationModes,
  cacheConfig,
  scrapingConfig,
  reportConfig,
};
