/**
 * @fileoverview KYCOS Memory — SQLite-based investigation state management.
 * Stores investigation plans, agent results, and audit trail.
 * Separate from cache.js which handles API response caching.
 */

import Database from 'better-sqlite3';
import { createLogger } from '../utils/logger.js';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('Memory');

/** @type {Database.Database|null} */
let db = null;

/**
 * Initialize the investigation memory database.
 * @param {string} [dbPath='./data/investigations.db']
 * @returns {Database.Database}
 */
export function initMemory(dbPath = './data/investigations.db') {
  if (db) return db;

  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS investigations (
      id          TEXT PRIMARY KEY,
      target_name TEXT NOT NULL,
      target_type TEXT NOT NULL DEFAULT 'individual',
      mode        TEXT NOT NULL DEFAULT 'standard',
      status      TEXT NOT NULL DEFAULT 'pending',
      plan        TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS agent_results (
      id                TEXT PRIMARY KEY,
      investigation_id  TEXT NOT NULL,
      agent_name        TEXT NOT NULL,
      status            TEXT NOT NULL DEFAULT 'pending',
      confidence        REAL,
      data              TEXT,
      red_flags         TEXT,
      sources           TEXT,
      execution_ms      INTEGER,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (investigation_id) REFERENCES investigations(id)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      investigation_id TEXT,
      event       TEXT NOT NULL,
      details     TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_results_investigation ON agent_results(investigation_id);
    CREATE INDEX IF NOT EXISTS idx_audit_investigation ON audit_log(investigation_id);
  `);

  logger.info(`Investigation memory initialized at ${dbPath}`);
  return db;
}

/**
 * Create a new investigation record.
 * @param {Object} target - Investigation target
 * @param {string} mode - Investigation mode
 * @returns {string} Investigation ID
 */
export function createInvestigation(target, mode) {
  if (!db) initMemory();

  const id = uuidv4();
  db.prepare(`
    INSERT INTO investigations (id, target_name, target_type, mode, status)
    VALUES (?, ?, ?, ?, 'running')
  `).run(id, target.name, target.type || 'individual', mode);

  logAudit(id, 'investigation_created', { target, mode });
  logger.info(`Investigation ${id.slice(0, 8)} created for "${target.name}"`);
  return id;
}

/**
 * Store the LLM-generated investigation plan.
 * @param {string} investigationId
 * @param {Object} plan - Investigation plan object
 */
export function storePlan(investigationId, plan) {
  if (!db) initMemory();

  db.prepare(`
    UPDATE investigations SET plan = ?, updated_at = datetime('now') WHERE id = ?
  `).run(JSON.stringify(plan), investigationId);

  logAudit(investigationId, 'plan_stored', { agentCount: plan.agents?.length });
}

/**
 * Store an agent's result.
 * @param {string} investigationId
 * @param {import('../utils/validator.js').AgentResultSchema} result - Agent result
 * @returns {string} Result record ID
 */
export function storeAgentResult(investigationId, result) {
  if (!db) initMemory();

  const id = uuidv4();
  db.prepare(`
    INSERT INTO agent_results (id, investigation_id, agent_name, status, confidence, data, red_flags, sources, execution_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    investigationId,
    result.agent,
    result.status,
    result.confidence,
    JSON.stringify(result.data),
    JSON.stringify(result.redFlags),
    JSON.stringify(result.sources),
    result.executionMs,
  );

  logAudit(investigationId, 'agent_completed', {
    agent: result.agent,
    status: result.status,
    confidence: result.confidence,
    redFlagCount: result.redFlags?.length || 0,
  });

  return id;
}

/**
 * Complete an investigation and update its status.
 * @param {string} investigationId
 * @param {string} [status='completed']
 */
export function completeInvestigation(investigationId, status = 'completed') {
  if (!db) initMemory();

  db.prepare(`
    UPDATE investigations
    SET status = ?, updated_at = datetime('now'), completed_at = datetime('now')
    WHERE id = ?
  `).run(status, investigationId);

  logAudit(investigationId, 'investigation_completed', { status });
}

/**
 * Get a full investigation with all results.
 * @param {string} investigationId
 * @returns {Object|null} Investigation with nested results
 */
export function getInvestigation(investigationId) {
  if (!db) initMemory();

  const investigation = db.prepare('SELECT * FROM investigations WHERE id = ?').get(investigationId);
  if (!investigation) return null;

  const results = db.prepare('SELECT * FROM agent_results WHERE investigation_id = ? ORDER BY created_at').all(investigationId);

  return {
    ...investigation,
    plan: investigation.plan ? JSON.parse(investigation.plan) : null,
    results: results.map(r => ({
      ...r,
      data: r.data ? JSON.parse(r.data) : {},
      redFlags: r.red_flags ? JSON.parse(r.red_flags) : [],
      sources: r.sources ? JSON.parse(r.sources) : [],
    })),
  };
}

/**
 * List recent investigations.
 * @param {number} [limit=20]
 * @returns {Object[]}
 */
export function listInvestigations(limit = 20) {
  if (!db) initMemory();

  return db.prepare(`
    SELECT id, target_name, target_type, mode, status, created_at, completed_at
    FROM investigations ORDER BY created_at DESC LIMIT ?
  `).all(limit);
}

/**
 * Log an audit event.
 * @param {string|null} investigationId
 * @param {string} event
 * @param {Object} [details]
 */
export function logAudit(investigationId, event, details = {}) {
  if (!db) initMemory();

  db.prepare(`
    INSERT INTO audit_log (investigation_id, event, details) VALUES (?, ?, ?)
  `).run(investigationId, event, JSON.stringify(details));
}

/**
 * Close the memory database connection.
 */
export function closeMemory() {
  if (db) {
    db.close();
    db = null;
  }
}
