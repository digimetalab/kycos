/**
 * @fileoverview KYCOS Spinner — ora wrapper for standardized loading indicators.
 */

import ora from 'ora';
import chalk from 'chalk';

/**
 * Create a styled spinner for an operation.
 * @param {string} text - Initial spinner text
 * @param {Object} [options={}]
 * @param {string} [options.spinner='dots12'] - Spinner style
 * @param {string} [options.color='cyan'] - Spinner color
 * @returns {import('ora').Ora}
 */
export function createSpinner(text, options = {}) {
  return ora({
    text: chalk.cyan(text),
    spinner: options.spinner || 'dots12',
    color: options.color || 'cyan',
  });
}

/**
 * Run an async function with a spinner, auto-succeeding/failing.
 * @param {string} text - Spinner text
 * @param {Function} fn - Async function to execute
 * @returns {Promise<any>} Result of fn
 */
export async function withSpinner(text, fn) {
  const spinner = createSpinner(text).start();
  try {
    const result = await fn(spinner);
    spinner.succeed(chalk.green(text));
    return result;
  } catch (err) {
    spinner.fail(chalk.red(`${text}: ${err.message}`));
    throw err;
  }
}

/**
 * Create a progress spinner that tracks multi-step operations.
 * @param {string} label - Operation label
 * @param {number} total - Total steps
 * @returns {{ spinner: import('ora').Ora, step: (text: string) => void, done: () => void }}
 */
export function progressSpinner(label, total) {
  let current = 0;
  const spinner = ora({
    text: chalk.cyan(`${label} [0/${total}]`),
    spinner: 'dots12',
  }).start();

  return {
    spinner,
    step(text) {
      current++;
      spinner.text = chalk.cyan(`${label} [${current}/${total}] `) + chalk.gray(text);
    },
    done() {
      spinner.succeed(chalk.green(`${label} — ${total} steps completed`));
    },
  };
}
