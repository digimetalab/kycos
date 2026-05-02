/**
 * @fileoverview KYCOS Investigation Database — SQLite persistent storage.
 * Stores all completed investigations with full agent results, red flags,
 * scores, and generated reports in a structured relational schema.
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('InvestigationDB');
let db = null;

const DB_PATH = './data/kycos-investigations.db';

/**
 * Initialize the investigation database and create tables.
 */
export function initInvestigationDB() {
  if (db) return db;

  if (!existsSync('./data')) mkdirSync('./data', { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    -- ═══════════════════════════════════════════════════════
    -- Main investigations table
    -- ═══════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS investigations (
      id                TEXT PRIMARY KEY,
      target_name       TEXT NOT NULL,
      target_type       TEXT DEFAULT 'individual',
      target_country    TEXT DEFAULT 'ID',
      target_id_number  TEXT,
      target_company    TEXT,
      target_email      TEXT,
      target_phone      TEXT,
      mode              TEXT NOT NULL,
      status            TEXT DEFAULT 'running',
      decision          TEXT,
      overall_score     INTEGER,
      overall_risk      TEXT,
      total_red_flags   INTEGER DEFAULT 0,
      agents_succeeded  INTEGER DEFAULT 0,
      agents_failed     INTEGER DEFAULT 0,
      agents_partial    INTEGER DEFAULT 0,
      execution_ms      INTEGER,
      plan_json         TEXT,
      report_path       TEXT,
      created_at        TEXT DEFAULT (datetime('now','localtime')),
      completed_at      TEXT
    );

    -- ═══════════════════════════════════════════════════════
    -- Per-agent results (one row per agent per investigation)
    -- ═══════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS agent_results (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      investigation_id  TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
      agent_name        TEXT NOT NULL,
      status            TEXT,
      confidence        REAL,
      execution_ms      INTEGER,
      data_json         TEXT,
      sources_json      TEXT,
      created_at        TEXT DEFAULT (datetime('now','localtime')),
      UNIQUE(investigation_id, agent_name)
    );

    -- ═══════════════════════════════════════════════════════
    -- Red flags (denormalized for fast querying)
    -- ═══════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS red_flags (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      investigation_id  TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
      agent_name        TEXT,
      severity          TEXT,
      category          TEXT,
      description       TEXT,
      source            TEXT,
      confidence        REAL,
      created_at        TEXT DEFAULT (datetime('now','localtime'))
    );

    -- ═══════════════════════════════════════════════════════
    -- Scoring components (5C+2W, scorecard, Z-Score, etc.)
    -- ═══════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS scores (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      investigation_id  TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
      score_type        TEXT NOT NULL,
      component         TEXT NOT NULL,
      value             REAL,
      max_value         REAL,
      weight            REAL,
      details           TEXT,
      created_at        TEXT DEFAULT (datetime('now','localtime'))
    );

    -- ═══════════════════════════════════════════════════════
    -- Generated reports metadata
    -- ═══════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS reports (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      investigation_id  TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
      format            TEXT NOT NULL,
      file_path         TEXT NOT NULL,
      file_size_bytes   INTEGER,
      template          TEXT,
      created_at        TEXT DEFAULT (datetime('now','localtime'))
    );

    -- ═══════════════════════════════════════════════════════
    -- Audit log (every event in an investigation lifecycle)
    -- ═══════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS audit_log (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      investigation_id  TEXT,
      event_type        TEXT NOT NULL,
      event_data        TEXT,
      created_at        TEXT DEFAULT (datetime('now','localtime'))
    );

    -- ═══════════════════════════════════════════════════════
    -- Indexes for fast queries
    -- ═══════════════════════════════════════════════════════
    CREATE INDEX IF NOT EXISTS idx_investigations_target ON investigations(target_name);
    CREATE INDEX IF NOT EXISTS idx_investigations_status ON investigations(status);
    CREATE INDEX IF NOT EXISTS idx_investigations_created ON investigations(created_at);
    CREATE INDEX IF NOT EXISTS idx_agent_results_inv ON agent_results(investigation_id);
    CREATE INDEX IF NOT EXISTS idx_red_flags_inv ON red_flags(investigation_id);
    CREATE INDEX IF NOT EXISTS idx_red_flags_severity ON red_flags(severity);
    CREATE INDEX IF NOT EXISTS idx_scores_inv ON scores(investigation_id);
    CREATE INDEX IF NOT EXISTS idx_audit_inv ON audit_log(investigation_id);
    CREATE INDEX IF NOT EXISTS idx_audit_type ON audit_log(event_type);
  `);

  logger.info(`Investigation DB initialized at ${DB_PATH}`);
  return db;
}

// ─── Prepared Statements (lazy) ────────────────────────────────

let _stmts = null;
function stmts() {
  if (_stmts) return _stmts;
  _stmts = {
    insertInvestigation: db.prepare(`
      INSERT INTO investigations (id, target_name, target_type, target_country, target_id_number, target_company, target_email, target_phone, mode, status, plan_json)
      VALUES (@id, @targetName, @targetType, @targetCountry, @targetIdNumber, @targetCompany, @targetEmail, @targetPhone, @mode, @status, @planJson)
    `),
    completeInvestigation: db.prepare(`
      UPDATE investigations SET status=@status, decision=@decision, overall_score=@overallScore, overall_risk=@overallRisk,
        total_red_flags=@totalRedFlags, agents_succeeded=@agentsSucceeded, agents_failed=@agentsFailed, agents_partial=@agentsPartial,
        execution_ms=@executionMs, report_path=@reportPath, completed_at=datetime('now','localtime')
      WHERE id=@id
    `),
    insertAgentResult: db.prepare(`
      INSERT OR REPLACE INTO agent_results (investigation_id, agent_name, status, confidence, execution_ms, data_json, sources_json)
      VALUES (@investigationId, @agentName, @status, @confidence, @executionMs, @dataJson, @sourcesJson)
    `),
    insertRedFlag: db.prepare(`
      INSERT INTO red_flags (investigation_id, agent_name, severity, category, description, source, confidence)
      VALUES (@investigationId, @agentName, @severity, @category, @description, @source, @confidence)
    `),
    insertScore: db.prepare(`
      INSERT INTO scores (investigation_id, score_type, component, value, max_value, weight, details)
      VALUES (@investigationId, @scoreType, @component, @value, @maxValue, @weight, @details)
    `),
    insertReport: db.prepare(`
      INSERT INTO reports (investigation_id, format, file_path, file_size_bytes, template)
      VALUES (@investigationId, @format, @filePath, @fileSizeBytes, @template)
    `),
    insertAudit: db.prepare(`
      INSERT INTO audit_log (investigation_id, event_type, event_data)
      VALUES (@investigationId, @eventType, @eventData)
    `),
    getInvestigation: db.prepare('SELECT * FROM investigations WHERE id = ?'),
    getAgentResults: db.prepare('SELECT * FROM agent_results WHERE investigation_id = ? ORDER BY created_at'),
    getRedFlags: db.prepare('SELECT * FROM red_flags WHERE investigation_id = ? ORDER BY severity, created_at'),
    getScores: db.prepare('SELECT * FROM scores WHERE investigation_id = ? ORDER BY score_type, component'),
    getReports: db.prepare('SELECT * FROM reports WHERE investigation_id = ? ORDER BY created_at DESC'),
    getAuditLog: db.prepare('SELECT * FROM audit_log WHERE investigation_id = ? ORDER BY created_at'),
    listInvestigations: db.prepare('SELECT * FROM investigations ORDER BY created_at DESC LIMIT ?'),
    countInvestigations: db.prepare('SELECT COUNT(*) as count FROM investigations'),
    searchByTarget: db.prepare('SELECT * FROM investigations WHERE target_name LIKE ? ORDER BY created_at DESC'),
  };
  return _stmts;
}

// ─── Public API ────────────────────────────────────────────────

/**
 * Save a complete investigation report to the database.
 * @param {Object} report - Full investigation report
 * @returns {string} investigation ID
 */
export function saveInvestigation(report) {
  const s = stmts();
  const target = report.target || {};
  const id = report.planId || report.id;

  const txn = db.transaction(() => {
    // 1. Insert investigation record
    s.insertInvestigation.run({
      id,
      targetName: target.name || 'Unknown',
      targetType: target.type || 'individual',
      targetCountry: target.country || 'ID',
      targetIdNumber: target.idNumber || null,
      targetCompany: target.company || null,
      targetEmail: target.email || null,
      targetPhone: target.phone || null,
      mode: report.mode || 'standard',
      status: 'completed',
      planJson: null,
    });

    // 2. Complete with results
    s.completeInvestigation.run({
      id,
      status: 'completed',
      decision: report.decision || 'N/A',
      overallScore: report.overallScore || 0,
      overallRisk: report.overallRisk || 'unknown',
      totalRedFlags: report.totalRedFlags || 0,
      agentsSucceeded: report.pipelineStats?.succeeded || 0,
      agentsFailed: report.pipelineStats?.failed || 0,
      agentsPartial: report.pipelineStats?.partial || 0,
      executionMs: report.executionMs || 0,
      reportPath: report.reportPath || null,
    });

    // 3. Store each agent result
    for (const result of (report.results || [])) {
      s.insertAgentResult.run({
        investigationId: id,
        agentName: result.agent,
        status: result.status,
        confidence: result.confidence,
        executionMs: result.executionMs || 0,
        dataJson: JSON.stringify(result.data || {}),
        sourcesJson: JSON.stringify(result.sources || []),
      });

      // 4. Store red flags
      for (const flag of (result.redFlags || [])) {
        s.insertRedFlag.run({
          investigationId: id,
          agentName: result.agent,
          severity: flag.severity || 'medium',
          category: flag.category || 'general',
          description: flag.description || '',
          source: flag.source || result.agent,
          confidence: flag.confidence || 0.5,
        });
      }
    }

    // 5. Extract and store scores
    const riskResult = (report.results || []).find(r => r.agent === 'risk');
    if (riskResult?.data?.scorecard) {
      const sc = riskResult.data.scorecard;
      for (const [comp, val] of Object.entries(sc)) {
        if (typeof val === 'number') {
          s.insertScore.run({
            investigationId: id, scoreType: 'credit_scorecard', component: comp,
            value: val, maxValue: comp === 'totalScore' ? 850 : 350, weight: null, details: null,
          });
        }
      }
    }
    if (riskResult?.data?.altmanZ) {
      s.insertScore.run({
        investigationId: id, scoreType: 'altman_zscore', component: 'zScore',
        value: riskResult.data.altmanZ.zScore, maxValue: 5, weight: null, details: riskResult.data.altmanZ.zone,
      });
    }

    const finResult = (report.results || []).find(r => r.agent === 'financial');
    if (finResult?.data?.compositeScore) {
      s.insertScore.run({
        investigationId: id, scoreType: '5c2w_composite', component: 'composite',
        value: finResult.data.compositeScore, maxValue: 100, weight: 1, details: null,
      });
    }

    // 6. Audit log
    s.insertAudit.run({ investigationId: id, eventType: 'investigation_completed', eventData: JSON.stringify({ decision: report.decision, score: report.overallScore, flags: report.totalRedFlags }) });
  });

  txn();
  logger.info(`Investigation ${id.slice(0, 8)} saved to database`);
  return id;
}

/**
 * Record a report generation event.
 */
export function saveReportRecord(investigationId, format, filePath, fileSizeBytes) {
  stmts().insertReport.run({ investigationId, format, filePath, fileSizeBytes: fileSizeBytes || 0, template: 'analytical' });
  stmts().insertAudit.run({ investigationId, eventType: 'report_generated', eventData: JSON.stringify({ format, filePath }) });
}

/**
 * Log an audit event.
 */
export function logAuditEvent(investigationId, eventType, eventData = {}) {
  stmts().insertAudit.run({ investigationId, eventType, eventData: JSON.stringify(eventData) });
}

/**
 * Get a full investigation with all related data.
 */
export function getFullInvestigation(id) {
  const s = stmts();
  const inv = s.getInvestigation.get(id);
  if (!inv) return null;
  return {
    ...inv,
    agentResults: s.getAgentResults.all(id),
    redFlags: s.getRedFlags.all(id),
    scores: s.getScores.all(id),
    reports: s.getReports.all(id),
    auditLog: s.getAuditLog.all(id),
  };
}

/**
 * List recent investigations.
 */
export function listInvestigations(limit = 20) {
  return stmts().listInvestigations.all(limit);
}

/**
 * Search investigations by target name.
 */
export function searchInvestigations(query) {
  return stmts().searchByTarget.all(`%${query}%`);
}

/**
 * Get database statistics.
 */
export function getDBStats() {
  const invCount = db.prepare('SELECT COUNT(*) as c FROM investigations').get().c;
  const flagCount = db.prepare('SELECT COUNT(*) as c FROM red_flags').get().c;
  const reportCount = db.prepare('SELECT COUNT(*) as c FROM reports').get().c;
  const byDecision = db.prepare('SELECT decision, COUNT(*) as c FROM investigations GROUP BY decision').all();
  const byRisk = db.prepare('SELECT overall_risk, COUNT(*) as c FROM investigations GROUP BY overall_risk').all();
  const avgScore = db.prepare('SELECT AVG(overall_score) as avg FROM investigations WHERE overall_score > 0').get()?.avg || 0;
  return { invCount, flagCount, reportCount, byDecision, byRisk, avgScore: Math.round(avgScore) };
}
