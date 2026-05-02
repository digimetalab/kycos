/**
 * @fileoverview KYCOS Animated Logo — gradient ASCII art with typewriter effect.
 */

import gradient from 'gradient-string';
import chalk from 'chalk';
import { COLORS, center, separator } from './theme.js';

// ─── Logo Variants ─────────────────────────────────────────────

const LOGO_LARGE = `
  ██╗  ██╗██╗   ██╗ ██████╗ ██████╗ ███████╗
  ██║ ██╔╝╚██╗ ██╔╝██╔════╝██╔═══██╗██╔════╝
  █████╔╝  ╚████╔╝ ██║     ██║   ██║███████╗
  ██╔═██╗   ╚██╔╝  ██║     ██║   ██║╚════██║
  ██║  ██╗   ██║   ╚██████╗╚██████╔╝███████║
  ╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═════╝ ╚══════╝`;

const LOGO_COMPACT = `
  ┃ ╲╱ ╱  ╻ ╻  ╺━╸ ╺━╸ ╺━╸
  ┃╺╋╸╱   ┗╋┛  ┃   ┃ ┃  ╺╋
  ╹  ╹     ╹   ╺━╸ ╺━╸ ╺━╸`;

// Gradient presets
const NEON_GRADIENT = gradient(['#00F0FF', '#BF40BF', '#FF00FF']);
const CYBER_GRADIENT = gradient(['#39FF14', '#00F0FF', '#4D7CFF']);
const FIRE_GRADIENT = gradient(['#FF3131', '#FF6B00', '#FFE600']);

/**
 * Print the full animated KYCOS logo.
 * @param {Object} [opts={}]
 * @param {boolean} [opts.animate=true] - Whether to animate
 * @param {'large'|'compact'} [opts.size='large'] - Logo size
 */
export async function printLogo(opts = {}) {
  const { animate = true, size = 'large' } = opts;
  const logo = size === 'compact' ? LOGO_COMPACT : LOGO_LARGE;

  console.clear();

  if (animate) {
    await animateGradient(logo);
  } else {
    console.log(NEON_GRADIENT(logo));
  }

  printTagline();
}

/**
 * Animate the logo with shifting gradient.
 */
async function animateGradient(logo) {
  const gradients = [
    gradient(['#00F0FF', '#4D7CFF', '#BF40BF']),
    gradient(['#4D7CFF', '#BF40BF', '#FF00FF']),
    gradient(['#BF40BF', '#FF00FF', '#FF3131']),
    gradient(['#FF00FF', '#FF3131', '#FF6B00']),
    gradient(['#FF3131', '#FF6B00', '#FFE600']),
    gradient(['#FF6B00', '#FFE600', '#39FF14']),
    gradient(['#FFE600', '#39FF14', '#00F0FF']),
    gradient(['#39FF14', '#00F0FF', '#4D7CFF']),
    gradient(['#00F0FF', '#BF40BF', '#FF00FF']),
  ];

  for (const g of gradients) {
    process.stdout.write('\x1b[2J\x1b[H'); // clear + home
    console.log(g(logo));
    await sleep(60);
  }
}

/**
 * Print the system tagline below the logo.
 */
function printTagline() {
  const width = 60;
  const tag = 'KYC OSINT Multi-Agent Intelligence System';
  const ver = 'v1.0.0';

  console.log('');
  console.log(center(COLORS.dimCyan('┄'.repeat(50)), width));
  console.log(center(COLORS.cyan.bold(tag), width));
  console.log(center(COLORS.dimGray(`${ver}  │  Node.js  │  7 AI Agents`), width));
  console.log(center(COLORS.dimCyan('┄'.repeat(50)), width));
  console.log('');
}

/**
 * Print a compact header for subcommands.
 */
export function printHeader(subtitle = '') {
  console.log('');
  console.log(NEON_GRADIENT('  ▄▀▄ KYCOS') + COLORS.dimGray(' ─ ') + COLORS.cyan(subtitle));
  console.log(COLORS.dimCyan('  ' + '─'.repeat(55)));
  console.log('');
}

/**
 * Print a section divider with title.
 */
export function printSection(title, icon = '▸') {
  console.log('');
  console.log(COLORS.cyan(`  ${icon} `) + COLORS.bright.bold(title));
  console.log(COLORS.dimCyan('  ' + '─'.repeat(55)));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
