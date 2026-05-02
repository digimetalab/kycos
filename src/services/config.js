/**
 * @fileoverview KYCOS Config Service — lowdb config + env loader.
 * Merges configuration from: env vars → kycos.config.js → data/config.json
 */

import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Config');

/** @type {Object|null} Cached merged config */
let mergedConfig = null;

/**
 * Load and merge all configuration sources.
 * Priority: env vars > kycos.config.js > data/config.json defaults
 *
 * @returns {Promise<Object>} Merged configuration
 */
export async function getConfig() {
  if (mergedConfig) return mergedConfig;

  // 1. Load kycos.config.js defaults
  let fileConfig = {};
  try {
    const configModule = await import('../../kycos.config.js');
    fileConfig = configModule.default || configModule;
  } catch (err) {
    logger.warn(`Could not load kycos.config.js: ${err.message}`);
  }

  // 2. Load lowdb persistent config
  let persistedConfig = {};
  try {
    const dataDir = process.env.KYCOS_DATA_DIR || './data';
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

    const configPath = join(dataDir, 'config.json');
    const { JSONFilePreset } = await import('lowdb/node');
    const db = await JSONFilePreset(configPath, {});
    persistedConfig = db.data || {};
  } catch (err) {
    logger.debug(`Lowdb config not available: ${err.message}`);
  }

  // 3. Environment variable overrides
  const envOverrides = {
    logLevel: process.env.KYCOS_LOG_LEVEL,
    cacheTtlHours: process.env.KYCOS_CACHE_TTL_HOURS ? parseInt(process.env.KYCOS_CACHE_TTL_HOURS, 10) : undefined,
    maxConcurrentAgents: process.env.KYCOS_MAX_CONCURRENT_AGENTS ? parseInt(process.env.KYCOS_MAX_CONCURRENT_AGENTS, 10) : undefined,
    rateLimitMs: process.env.KYCOS_RATE_LIMIT_MS ? parseInt(process.env.KYCOS_RATE_LIMIT_MS, 10) : undefined,
    dataDir: process.env.KYCOS_DATA_DIR,
    encryptionKey: process.env.KYCOS_ENCRYPTION_KEY,
  };

  // Remove undefined values
  Object.keys(envOverrides).forEach(k => envOverrides[k] === undefined && delete envOverrides[k]);

  // 4. Merge: file defaults < persisted < env
  mergedConfig = { ...fileConfig, ...persistedConfig, ...envOverrides };

  logger.debug('Configuration loaded and merged');
  return mergedConfig;
}

/**
 * Update a persistent config value (writes to data/config.json).
 * @param {string} key
 * @param {any} value
 */
export async function setConfigValue(key, value) {
  try {
    const dataDir = process.env.KYCOS_DATA_DIR || './data';
    const configPath = join(dataDir, 'config.json');
    const { JSONFilePreset } = await import('lowdb/node');
    const db = await JSONFilePreset(configPath, {});
    db.data[key] = value;
    await db.write();
    // Invalidate cached config
    mergedConfig = null;
    logger.info(`Config updated: ${key}`);
  } catch (err) {
    logger.error(`Failed to persist config: ${err.message}`);
  }
}

/**
 * Get available API provider status.
 * @returns {Object} Provider availability map
 */
export function getProviderStatus() {
  return {
    anthropic:   !!process.env.ANTHROPIC_API_KEY,
    gemini:      !!process.env.GOOGLE_AI_API_KEY,
    openrouter:  !!process.env.OPENROUTER_API_KEY,
    shodan:      !!process.env.SHODAN_API_KEY,
    hibp:        !!process.env.HIBP_API_KEY,
    opencorporates: !!process.env.OPENCORPORATES_API_KEY,
  };
}
