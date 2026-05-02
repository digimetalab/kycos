/**
 * @fileoverview KYCOS Logger — chalk-based colored terminal output.
 * Provides leveled logging with timestamps and agent context.
 */

import chalk from 'chalk';

/** @enum {number} */
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };

/** Current log level from environment */
let currentLevel = LOG_LEVELS[process.env.KYCOS_LOG_LEVEL || 'info'] ?? LOG_LEVELS.info;

/**
 * Format a timestamp for log output.
 * @returns {string}
 */
function timestamp() {
  return chalk.gray(new Date().toISOString().replace('T', ' ').slice(0, 19));
}

/**
 * Create a prefixed logger for a specific agent or module.
 * @param {string} prefix - Module or agent name
 * @returns {Object} Logger instance with debug/info/warn/error methods
 */
export function createLogger(prefix) {
  const tag = chalk.cyan(`[${prefix}]`);

  return {
    debug: (...args) => {
      if (currentLevel <= LOG_LEVELS.debug) {
        console.log(timestamp(), tag, chalk.gray('DBG'), ...args);
      }
    },
    info: (...args) => {
      if (currentLevel <= LOG_LEVELS.info) {
        console.log(timestamp(), tag, chalk.blue('INF'), ...args);
      }
    },
    success: (...args) => {
      if (currentLevel <= LOG_LEVELS.info) {
        console.log(timestamp(), tag, chalk.green('OK '), ...args);
      }
    },
    warn: (...args) => {
      if (currentLevel <= LOG_LEVELS.warn) {
        console.warn(timestamp(), tag, chalk.yellow('WRN'), ...args);
      }
    },
    error: (...args) => {
      if (currentLevel <= LOG_LEVELS.error) {
        console.error(timestamp(), tag, chalk.red('ERR'), ...args);
      }
    },
    /** Log a red flag finding */
    flag: (severity, message) => {
      const colors = {
        critical: chalk.bgRed.white.bold,
        high: chalk.red.bold,
        medium: chalk.yellow,
        low: chalk.gray,
      };
      const colorFn = colors[severity] || chalk.white;
      console.log(timestamp(), tag, colorFn(`🚩 [${severity.toUpperCase()}]`), message);
    },
    /** Log agent execution time */
    timing: (label, ms) => {
      const color = ms > 10000 ? chalk.red : ms > 5000 ? chalk.yellow : chalk.green;
      console.log(timestamp(), tag, chalk.magenta('⏱ '), `${label}:`, color(`${ms}ms`));
    },
  };
}

/**
 * Set the global log level.
 * @param {string} level - One of: debug, info, warn, error, silent
 */
export function setLogLevel(level) {
  if (level in LOG_LEVELS) {
    currentLevel = LOG_LEVELS[level];
  }
}

/** Default module logger */
export const log = createLogger('KYCOS');
