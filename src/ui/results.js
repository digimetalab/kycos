/**
 * @fileoverview KYCOS Results Display — investigation results dashboard.
 */

import chalk from 'chalk';
import gradient from 'gradient-string';
import { COLORS, ICONS, progressBar, decisionStyle, severityColor } from './theme.js';

/**
 * Print the full investigation results dashboard.
 * @param {Object} report - Investigation report
 */
export function printResults(report) {
  const width = 58;

  console.log('');
  console.log(COLORS.cyan('  ╔══════════════════════════════════════════════════════════╗'));
  console.log(COLORS.cyan('  ║') + gradient.cristal('  ██ INVESTIGATION RESULTS ██                             ') + COLORS.cyan('║'));
  console.log(COLORS.cyan('  ╠══════════════════════════════════════════════════════════╣'));

  // Target info
  console.log(COLORS.cyan('  ║') + `  ${ICONS.target} Target:  ${COLORS.bright.bold(report.target?.name || 'Unknown')}`.padEnd(70) + COLORS.cyan('║'));
  console.log(COLORS.cyan('  ║') + `    Type:    ${report.target?.type || '—'}  │  Country: ${report.target?.country || '—'}  │  Mode: ${report.mode}`.padEnd(59) + COLORS.cyan('║'));
  console.log(COLORS.cyan('  ╠══════════════════════════════════════════════════════════╣'));

  // Decision + Score
  const decision = report.decision || 'N/A';
  const score = report.overallScore || 0;
  const risk = report.overallRisk || 'unknown';

  const riskColors = { low: COLORS.green, medium: COLORS.yellow, high: COLORS.orange, critical: COLORS.red };
  const riskFn = riskColors[risk] || COLORS.text;

  console.log(COLORS.cyan('  ║') + `  Decision: ${decisionStyle(decision)}   Score: ${COLORS.bright.bold(String(score))}${COLORS.dimGray('/850')}   Risk: ${riskFn.bold(risk.toUpperCase())}`.padEnd(82) + COLORS.cyan('║'));
  console.log(COLORS.cyan('  ║') + `  Score:    ${progressBar(Math.round((score / 850) * 100), 40)}`.padEnd(70) + COLORS.cyan('║'));
  console.log(COLORS.cyan('  ╠══════════════════════════════════════════════════════════╣'));

  // Agent results table
  console.log(COLORS.cyan('  ║') + COLORS.bright.bold('  Agent                Status   Conf   Flags  Time   ') + COLORS.cyan('║'));
  console.log(COLORS.cyan('  ║') + COLORS.dimCyan('  ─────────────────────────────────────────────────────── ') + COLORS.cyan('║'));

  const agentIcons = { identity: '🪪', social: '📱', financial: '💰', legal: '⚖️', digital: '🌐', network: '🔗', risk: '📊' };

  for (const result of (report.results || [])) {
    const icon = agentIcons[result.agent] || '🔧';
    const name = result.agent.padEnd(12);
    const statusIcon = result.status === 'success' ? COLORS.green('✓') : result.status === 'partial' ? COLORS.yellow('◐') : COLORS.red('✗');
    const statusLabel = result.status === 'success' ? COLORS.green('OK    ') : result.status === 'partial' ? COLORS.yellow('PART  ') : COLORS.red('FAIL  ');
    const conf = `${Math.round(result.confidence * 100)}%`.padEnd(5);
    const flags = String(result.redFlags?.length || 0).padEnd(5);
    const time = `${result.executionMs || 0}ms`;

    const flagColor = (result.redFlags?.length || 0) > 0 ? COLORS.yellow : COLORS.dimGray;

    console.log(COLORS.cyan('  ║') + `  ${icon} ${statusIcon} ${name} ${statusLabel} ${conf}  ${flagColor(flags)} ${COLORS.dimGray(time)}`.padEnd(73) + COLORS.cyan('║'));
  }

  // Red flags
  const allFlags = (report.results || []).flatMap(r => (r.redFlags || []).map(f => ({ ...f, agent: r.agent })));
  if (allFlags.length > 0) {
    console.log(COLORS.cyan('  ╠══════════════════════════════════════════════════════════╣'));
    console.log(COLORS.cyan('  ║') + COLORS.red.bold(`  ${ICONS.flag} RED FLAGS (${allFlags.length})                                      `) + COLORS.cyan('║'));
    console.log(COLORS.cyan('  ║') + COLORS.dimCyan('  ─────────────────────────────────────────────────────── ') + COLORS.cyan('║'));

    for (const flag of allFlags.slice(0, 10)) {
      const sev = severityColor(flag.severity);
      const sevLabel = sev(flag.severity?.toUpperCase().padEnd(8) || 'UNKNOWN ');
      const desc = flag.description?.slice(0, 45) || 'Unknown';
      console.log(COLORS.cyan('  ║') + `  ${sevLabel} ${desc}`.padEnd(59) + COLORS.cyan('║'));
    }

    if (allFlags.length > 10) {
      console.log(COLORS.cyan('  ║') + COLORS.dimGray(`  ... and ${allFlags.length - 10} more flags`).padEnd(59) + COLORS.cyan('║'));
    }
  }

  // Footer
  const elapsed = report.executionMs ? `${(report.executionMs / 1000).toFixed(1)}s` : '—';
  const stats = report.pipelineStats || {};
  console.log(COLORS.cyan('  ╠══════════════════════════════════════════════════════════╣'));
  console.log(COLORS.cyan('  ║') + `  Duration: ${COLORS.cyan(elapsed)}  │  Agents: ${COLORS.green(`${stats.succeeded || 0}✓`)} ${COLORS.yellow(`${stats.partial || 0}◐`)} ${COLORS.red(`${stats.failed || 0}✗`)}  │  Flags: ${COLORS.yellow(String(report.totalRedFlags || 0))}`.padEnd(82) + COLORS.cyan('║'));
  console.log(COLORS.cyan('  ║') + COLORS.dimGray(`  ${new Date(report.completedAt || Date.now()).toLocaleString()}`).padEnd(59) + COLORS.cyan('║'));
  console.log(COLORS.cyan('  ╚══════════════════════════════════════════════════════════╝'));
  console.log('');
}

/**
 * Print a styled connectivity/status check.
 * @param {Object} providers - Provider availability map
 */
export function printProviderStatus(providers) {
  console.log('');
  console.log(COLORS.cyan('  ╔══════════════════════════════════════════════════════════╗'));
  console.log(COLORS.cyan('  ║') + COLORS.bright.bold('  ⚡ SYSTEM STATUS                                       ') + COLORS.cyan('║'));
  console.log(COLORS.cyan('  ╠══════════════════════════════════════════════════════════╣'));

  const checks = [
    { name: 'Anthropic (Claude)',  key: 'ANTHROPIC_API_KEY',   icon: '🤖' },
    { name: 'Google AI (Gemini)',  key: 'GOOGLE_AI_API_KEY',   icon: '💎' },
    { name: 'OpenRouter (GPT-4o)', key: 'OPENROUTER_API_KEY',  icon: '🌐' },
    { name: 'Shodan',             key: 'SHODAN_API_KEY',       icon: '🔍' },
    { name: 'HIBP',               key: 'HIBP_API_KEY',         icon: '🔓' },
  ];

  for (const c of checks) {
    const ok = !!process.env[c.key];
    const status = ok ? COLORS.green('● ONLINE ') : COLORS.red('○ OFFLINE');
    const label = (c.icon + ' ' + c.name).padEnd(25);
    console.log(COLORS.cyan('  ║') + `  ${label}  ${status}`.padEnd(70) + COLORS.cyan('║'));
  }

  console.log(COLORS.cyan('  ╚══════════════════════════════════════════════════════════╝'));
  console.log('');
}
