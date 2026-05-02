/**
 * @fileoverview KYCOS File Logger — structured per-investigation log files.
 * Creates timestamped log files in the logs/ directory for each investigation.
 */

import { existsSync, mkdirSync, appendFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const LOGS_DIR = './logs';
const MAX_LOG_FILES = 100;

let currentLogFile = null;
let currentInvestigationId = null;

/**
 * Initialize the logs directory.
 */
export function initFileLogger() {
  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
  rotateOldLogs();
}

/**
 * Start a new log file for an investigation.
 * @param {string} investigationId
 * @param {Object} target - Investigation target
 * @param {string} mode - Investigation mode
 * @returns {string} Log file path
 */
export function startInvestigationLog(investigationId, target, mode) {
  initFileLogger();

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const slug = (target.name || 'unknown').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
  const filename = `kycos_${ts}_${slug}_${investigationId.slice(0, 8)}.log`;
  currentLogFile = join(LOGS_DIR, filename);
  currentInvestigationId = investigationId;

  const header = [
    '═'.repeat(70),
    `KYCOS Investigation Log`,
    '═'.repeat(70),
    `Investigation ID : ${investigationId}`,
    `Target           : ${target.name}`,
    `Type             : ${target.type || 'individual'}`,
    `Country          : ${target.country || 'ID'}`,
    `Company          : ${target.company || '—'}`,
    `Email            : ${target.email || '—'}`,
    `Mode             : ${mode}`,
    `Started At       : ${new Date().toISOString()}`,
    `Node Version     : ${process.version}`,
    `Platform         : ${process.platform}`,
    '═'.repeat(70),
    '',
  ].join('\n');

  writeFileSync(currentLogFile, header, 'utf-8');
  return currentLogFile;
}

/**
 * Append a log entry.
 * @param {'INFO'|'WARN'|'ERROR'|'DEBUG'|'AGENT'|'FLAG'|'SCORE'} level
 * @param {string} message
 * @param {Object} [data] - Optional structured data
 */
export function log(level, message, data = null) {
  if (!currentLogFile) return;

  const ts = new Date().toISOString();
  let line = `[${ts}] [${level.padEnd(5)}] ${message}`;
  if (data) {
    line += '\n' + JSON.stringify(data, null, 2).split('\n').map(l => '  │ ' + l).join('\n');
  }
  line += '\n';

  appendFileSync(currentLogFile, line, 'utf-8');
}

/**
 * Log agent lifecycle events.
 */
export function logAgentStart(agentName) {
  log('AGENT', `▸ Agent [${agentName}] started execution`);
}

export function logAgentComplete(agentName, result) {
  log('AGENT', `✓ Agent [${agentName}] completed — status: ${result.status}, confidence: ${(result.confidence * 100).toFixed(0)}%, flags: ${result.redFlags?.length || 0}, time: ${result.executionMs}ms`);
  if (result.redFlags?.length > 0) {
    for (const flag of result.redFlags) {
      log('FLAG', `  ⚑ [${flag.severity?.toUpperCase()}] ${flag.description}`, { category: flag.category, source: flag.source, confidence: flag.confidence });
    }
  }
}

export function logAgentError(agentName, error) {
  log('ERROR', `✗ Agent [${agentName}] failed: ${error.message || error}`);
}

/**
 * Log scoring events.
 */
export function logScore(scoreType, component, value, maxValue) {
  log('SCORE', `${scoreType} → ${component}: ${value}/${maxValue}`);
}

/**
 * Log pipeline events.
 */
export function logPipelineStart(agentCount) {
  log('INFO', `Pipeline started with ${agentCount} agents (Promise.allSettled)`);
  log('INFO', '─'.repeat(50));
}

export function logPipelineComplete(stats) {
  log('INFO', '─'.repeat(50));
  log('INFO', `Pipeline complete: ${stats.succeeded}✓ ${stats.partial}◐ ${stats.failed}✗ in ${stats.totalMs}ms`);
}

/**
 * Log the final decision.
 */
export function logDecision(report) {
  log('INFO', '');
  log('INFO', '═'.repeat(50));
  log('INFO', 'FINAL DECISION');
  log('INFO', '═'.repeat(50));
  log('INFO', `Decision     : ${report.decision}`);
  log('INFO', `Overall Score: ${report.overallScore}/850`);
  log('INFO', `Risk Level   : ${report.overallRisk}`);
  log('INFO', `Red Flags    : ${report.totalRedFlags}`);
  log('INFO', `Duration     : ${report.executionMs}ms`);
  log('INFO', '═'.repeat(50));
}

/**
 * Finalize and close the log file.
 */
export function finalizeLog(report) {
  if (!currentLogFile) return currentLogFile;

  logDecision(report);

  const footer = [
    '',
    '═'.repeat(70),
    `Investigation completed at ${new Date().toISOString()}`,
    `Log file: ${currentLogFile}`,
    '═'.repeat(70),
    '',
  ].join('\n');

  appendFileSync(currentLogFile, footer, 'utf-8');
  const path = currentLogFile;
  currentLogFile = null;
  currentInvestigationId = null;
  return path;
}

/**
 * Get the current log file path.
 */
export function getCurrentLogPath() {
  return currentLogFile;
}

/**
 * Rotate old log files — keep only the last MAX_LOG_FILES.
 */
function rotateOldLogs() {
  try {
    const files = readdirSync(LOGS_DIR)
      .filter(f => f.startsWith('kycos_') && f.endsWith('.log'))
      .map(f => ({ name: f, path: join(LOGS_DIR, f), mtime: statSync(join(LOGS_DIR, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > MAX_LOG_FILES) {
      for (const old of files.slice(MAX_LOG_FILES)) {
        unlinkSync(old.path);
      }
    }
  } catch { /* ignore rotation errors */ }
}

/**
 * List recent log files.
 * @param {number} [limit=20]
 * @returns {Array<{name: string, path: string, size: number, date: Date}>}
 */
export function listLogFiles(limit = 20) {
  initFileLogger();
  try {
    return readdirSync(LOGS_DIR)
      .filter(f => f.startsWith('kycos_') && f.endsWith('.log'))
      .map(f => {
        const p = join(LOGS_DIR, f);
        const st = statSync(p);
        return { name: f, path: p, size: st.size, date: st.mtime };
      })
      .sort((a, b) => b.date - a.date)
      .slice(0, limit);
  } catch { return []; }
}
