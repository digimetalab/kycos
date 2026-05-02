/**
 * @fileoverview KYCOS Theme — color palette and style constants.
 * Cyberpunk-inspired neon-on-dark aesthetic.
 */

import chalk from 'chalk';

// ─── Color Palette ─────────────────────────────────────────────

export const COLORS = {
  // Primary neon colors
  cyan:      chalk.hex('#00F0FF'),
  magenta:   chalk.hex('#FF00FF'),
  green:     chalk.hex('#39FF14'),
  red:       chalk.hex('#FF3131'),
  yellow:    chalk.hex('#FFE600'),
  orange:    chalk.hex('#FF6B00'),
  blue:      chalk.hex('#4D7CFF'),
  purple:    chalk.hex('#BF40BF'),

  // Dim/muted
  dimCyan:   chalk.hex('#007A80'),
  dimGray:   chalk.hex('#555555'),
  midGray:   chalk.hex('#888888'),
  lightGray: chalk.hex('#BBBBBB'),

  // Semantic
  success:   chalk.hex('#39FF14'),
  warning:   chalk.hex('#FFE600'),
  error:     chalk.hex('#FF3131'),
  info:      chalk.hex('#00F0FF'),

  // Text
  bright:    chalk.hex('#FFFFFF'),
  text:      chalk.hex('#CCCCCC'),
  muted:     chalk.hex('#666666'),
};

// ─── Status Icons ──────────────────────────────────────────────

export const ICONS = {
  success:  '✓',
  fail:     '✗',
  partial:  '◐',
  pending:  '○',
  running:  '●',
  arrow:    '▸',
  arrowR:   '►',
  dot:      '•',
  star:     '★',
  flag:     '⚑',
  shield:   '🛡',
  bolt:     '⚡',
  target:   '◎',
  chart:    '📊',
  lock:     '🔒',
  globe:    '🌐',
  eye:      '👁',
  brain:    '🧠',
  warning:  '⚠',
  fire:     '🔥',
  check:    '✔',
  cross:    '✘',
  bar:      '█',
  barLight: '░',
  line:     '─',
  doubleLine: '═',
};

// ─── Box Characters ────────────────────────────────────────────

export const BOX = {
  topLeft:     '╔',
  topRight:    '╗',
  bottomLeft:  '╚',
  bottomRight: '╝',
  horizontal:  '═',
  vertical:    '║',
  teeRight:    '╠',
  teeLeft:     '╣',
  teeDown:     '╦',
  teeUp:       '╩',
  cross:       '╬',

  // Single line variants
  sTopLeft:     '┌',
  sTopRight:    '┐',
  sBottomLeft:  '└',
  sBottomRight: '┘',
  sHorizontal:  '─',
  sVertical:    '│',
  sTeeRight:    '├',
  sTeeLeft:     '┤',
};

// ─── Style Helpers ─────────────────────────────────────────────

export function separator(char = '─', length = 60, color = COLORS.dimCyan) {
  return color(char.repeat(length));
}

export function doubleSeparator(length = 60) {
  return COLORS.cyan('═'.repeat(length));
}

export function pad(str, len, char = ' ') {
  return str + char.repeat(Math.max(0, len - stripAnsi(str).length));
}

export function center(str, width = 60) {
  const stripped = stripAnsi(str);
  const padding = Math.max(0, Math.floor((width - stripped.length) / 2));
  return ' '.repeat(padding) + str;
}

export function rightAlign(str, width = 60) {
  const stripped = stripAnsi(str);
  const padding = Math.max(0, width - stripped.length);
  return ' '.repeat(padding) + str;
}

/**
 * Strip ANSI escape codes from a string.
 */
export function stripAnsi(str) {
  return str.replace(/\u001b\[[0-9;]*m/g, '');
}

/**
 * Create a progress bar.
 * @param {number} percent - 0-100
 * @param {number} [width=30] - Bar width in characters
 * @param {Function} [fillColor] - Chalk color for filled portion
 * @returns {string}
 */
export function progressBar(percent, width = 30, fillColor = COLORS.cyan) {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return fillColor(ICONS.bar.repeat(filled)) + COLORS.dimGray(ICONS.barLight.repeat(empty));
}

/**
 * Severity to color mapping.
 */
export function severityColor(severity) {
  const map = {
    critical: COLORS.red,
    high:     COLORS.orange,
    medium:   COLORS.yellow,
    low:      COLORS.midGray,
  };
  return map[severity] || COLORS.text;
}

/**
 * Decision to color mapping.
 */
export function decisionStyle(decision) {
  const map = {
    APPROVE: chalk.bgHex('#16a34a').hex('#FFFFFF').bold,
    EDD:     chalk.bgHex('#ca8a04').hex('#000000').bold,
    REJECT:  chalk.bgHex('#dc2626').hex('#FFFFFF').bold,
  };
  return (map[decision] || COLORS.text)(` ${decision} `);
}
