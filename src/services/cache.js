/**
 * @fileoverview KYCOS Cache — better-sqlite3 caching layer.
 * Provides TTL-based caching for API responses and scraped data
 * to avoid redundant requests and reduce costs.
 */

import Database from 'better-sqlite3';
import { createLogger } from '../utils/logger.js';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const logger = createLogger('Cache');

/** @type {Database.Database|null} */
let db = null;

/**
 * Initialize the SQLite cache database.
 * @param {string} [dbPath='./data/cache.db'] - Path to the SQLite file
 * @returns {Database.Database}
 */
export function initCache(dbPath = './data/cache.db') {
  if (db) return db;

  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS cache (
      key     TEXT PRIMARY KEY,
      value   TEXT NOT NULL,
      created INTEGER NOT NULL,
      ttl_ms  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cache_created ON cache(created);
  `);

  logger.info(`Cache initialized at ${dbPath}`);
  return db;
}

/**
 * Get a cached value if it exists and hasn't expired.
 * @param {string} key - Cache key
 * @returns {any|null} Parsed JSON value or null if miss/expired
 */
export function cacheGet(key) {
  if (!db) initCache();

  const row = db.prepare('SELECT value, created, ttl_ms FROM cache WHERE key = ?').get(key);
  if (!row) return null;

  const age = Date.now() - row.created;
  if (age > row.ttl_ms) {
    db.prepare('DELETE FROM cache WHERE key = ?').run(key);
    return null;
  }

  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

/**
 * Store a value in the cache.
 * @param {string} key - Cache key
 * @param {any} value - Value to cache (will be JSON-serialized)
 * @param {number} [ttlMs=86400000] - Time to live in milliseconds (default: 24h)
 */
export function cacheSet(key, value, ttlMs = 86_400_000) {
  if (!db) initCache();

  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  db.prepare(`
    INSERT OR REPLACE INTO cache (key, value, created, ttl_ms)
    VALUES (?, ?, ?, ?)
  `).run(key, serialized, Date.now(), ttlMs);
}

/**
 * Invalidate a specific cache entry or clear all.
 * @param {string} [key] - Specific key to invalidate. If omitted, clears all.
 */
export function cacheInvalidate(key) {
  if (!db) initCache();

  if (key) {
    db.prepare('DELETE FROM cache WHERE key = ?').run(key);
  } else {
    db.exec('DELETE FROM cache');
    logger.info('Cache cleared');
  }
}

/**
 * Get cache statistics.
 * @returns {{ totalEntries: number, activeEntries: number, expiredEntries: number }}
 */
export function cacheStats() {
  if (!db) initCache();

  const total = db.prepare('SELECT COUNT(*) as count FROM cache').get();
  const expired = db.prepare('SELECT COUNT(*) as count FROM cache WHERE (? - created) > ttl_ms').get(Date.now());

  return {
    totalEntries: total.count,
    expiredEntries: expired.count,
    activeEntries: total.count - expired.count,
  };
}

/**
 * Purge expired entries from the cache.
 * @returns {number} Number of entries purged
 */
export function cachePurge() {
  if (!db) initCache();

  const result = db.prepare('DELETE FROM cache WHERE (? - created) > ttl_ms').run(Date.now());
  logger.info(`Purged ${result.changes} expired cache entries`);
  return result.changes;
}

/**
 * Close the cache database connection.
 */
export function cacheClose() {
  if (db) {
    db.close();
    db = null;
  }
}
