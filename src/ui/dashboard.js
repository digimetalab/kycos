/**
 * @fileoverview KYCOS Agent Dashboard — real-time progress display.
 * Shows each agent's status with animated spinners and progress bars.
 */

import chalk from 'chalk';
import { COLORS, ICONS, progressBar, severityColor, stripAnsi } from './theme.js';

const AGENT_ICONS = {
  identity:  '🪪', social: '📱', financial: '💰',
  legal:     '⚖️', digital: '🌐', network: '🔗', risk: '📊',
};

const AGENT_LABELS = {
  identity: 'Identity Verification', social: 'Social Intelligence',
  financial: 'Financial Analysis', legal: 'Legal & Compliance',
  digital: 'Digital Footprint', network: 'Network Analysis', risk: 'Risk Assessment',
};

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * Create a live dashboard for agent execution tracking.
 * @param {string[]} agentNames - List of agent names to track
 * @returns {Object} Dashboard controller
 */
export function createDashboard(agentNames) {
  const state = {};
  let frameIdx = 0;
  let intervalId = null;
  let startMs = Date.now();

  for (const name of agentNames) {
    state[name] = { status: 'pending', confidence: 0, flags: 0, ms: 0, message: 'Waiting...' };
  }

  function render() {
    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
    const lines = [];

    lines.push('');
    lines.push(COLORS.cyan('  ╔══════════════════════════════════════════════════════════╗'));
    lines.push(COLORS.cyan('  ║') + COLORS.bright.bold('  🧠 AGENT EXECUTION DASHBOARD              ') + COLORS.dimGray(`${elapsed}s `) + COLORS.cyan('║'));
    lines.push(COLORS.cyan('  ╠══════════════════════════════════════════════════════════╣'));

    for (const name of agentNames) {
      const s = state[name];
      const icon = AGENT_ICONS[name] || '🔧';
      const label = (AGENT_LABELS[name] || name).padEnd(22);

      let statusStr;
      if (s.status === 'pending') {
        statusStr = COLORS.dimGray(`○ ${label}`) + COLORS.dimGray(' Waiting...');
      } else if (s.status === 'running') {
        const spinner = COLORS.cyan(SPINNER_FRAMES[frameIdx % SPINNER_FRAMES.length]);
        statusStr = spinner + COLORS.cyan(` ${label}`) + COLORS.dimGray(s.message);
      } else if (s.status === 'success') {
        const conf = `${Math.round(s.confidence * 100)}%`;
        const bar = progressBar(s.confidence * 100, 12, COLORS.green);
        statusStr = COLORS.green(`✓ ${label}`) + bar + COLORS.green(` ${conf}`) + COLORS.dimGray(` ${s.ms}ms`) + (s.flags > 0 ? COLORS.yellow(` ⚑${s.flags}`) : '');
      } else if (s.status === 'partial') {
        statusStr = COLORS.yellow(`◐ ${label}`) + COLORS.yellow('Partial ') + COLORS.dimGray(`${s.ms}ms`);
      } else {
        statusStr = COLORS.red(`✗ ${label}`) + COLORS.red('Failed ') + COLORS.dimGray(s.message);
      }

      lines.push(COLORS.cyan('  ║') + `  ${icon} ${statusStr}`.padEnd(70) + COLORS.cyan('║'));
    }

    // Summary bar
    const done = Object.values(state).filter(s => ['success', 'partial', 'failed'].includes(s.status)).length;
    const total = agentNames.length;
    const pct = Math.round((done / total) * 100);
    lines.push(COLORS.cyan('  ╠══════════════════════════════════════════════════════════╣'));
    lines.push(COLORS.cyan('  ║') + `  Progress: ${progressBar(pct, 30)} ${COLORS.cyan(`${pct}%`)} (${done}/${total})`.padEnd(70) + COLORS.cyan('║'));
    lines.push(COLORS.cyan('  ╚══════════════════════════════════════════════════════════╝'));

    // Move cursor up and overwrite
    const totalLines = lines.length;
    if (done < total) {
      process.stdout.write(`\x1b[${totalLines}A`); // move up
    }
    console.log(lines.join('\n'));

    frameIdx++;
  }

  return {
    start() {
      startMs = Date.now();
      render();
      intervalId = setInterval(render, 120);
    },

    updateAgent(name, update) {
      if (state[name]) Object.assign(state[name], update);
    },

    agentStarted(name) {
      this.updateAgent(name, { status: 'running', message: 'Analyzing...' });
    },

    agentCompleted(name, result) {
      this.updateAgent(name, {
        status: result.status,
        confidence: result.confidence,
        flags: result.redFlags?.length || 0,
        ms: result.executionMs,
        message: result.status === 'failed' ? (result.data?.error || 'Error') : '',
      });
    },

    stop() {
      if (intervalId) clearInterval(intervalId);
      render(); // final render
    },
  };
}
