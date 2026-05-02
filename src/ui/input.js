/**
 * @fileoverview KYCOS Interactive Input — futuristic terminal prompts.
 */

import readline from 'node:readline';
import chalk from 'chalk';
import { COLORS, ICONS } from './theme.js';

function createRL() {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function ask(rl, question, defaultValue = '') {
  const hint = defaultValue ? COLORS.dimGray(` (${defaultValue})`) : '';
  const prompt = COLORS.cyan(`  ${ICONS.arrow} `) + COLORS.bright(question) + hint + COLORS.cyan(' › ');
  return new Promise(resolve => rl.question(prompt, a => resolve(a.trim() || defaultValue)));
}

export async function interactiveInput() {
  const rl = createRL();
  try {
    console.log('');
    console.log(COLORS.cyan('  ╔══════════════════════════════════════════════════════╗'));
    console.log(COLORS.cyan('  ║') + COLORS.bright.bold('        🎯 NEW INVESTIGATION                          ') + COLORS.cyan('║'));
    console.log(COLORS.cyan('  ╚══════════════════════════════════════════════════════╝'));
    console.log('');

    const name = await ask(rl, 'Target Name');
    if (!name) { console.log(COLORS.error('  ✗ Name required')); process.exit(1); }

    console.log(COLORS.cyan(`  ${ICONS.arrow} `) + COLORS.bright('Target Type'));
    console.log(COLORS.cyan(`    ${ICONS.arrowR} `) + COLORS.cyan.bold('individual') + COLORS.dimGray(' [1]'));
    console.log(COLORS.dimGray('      corporation [2]'));
    const typeAnswer = await new Promise(r => rl.question(COLORS.cyan('  Choice › '), r));
    const type = typeAnswer.trim() === '2' ? 'corporation' : 'individual';
    console.log('');

    const company = type === 'corporation' ? await ask(rl, 'Company Name', name) : '';
    const idNumber = await ask(rl, 'ID Number (KTP/NPWP/Passport)');
    const email = await ask(rl, 'Email Address');
    const phone = await ask(rl, 'Phone Number');
    const country = await ask(rl, 'Country Code', 'ID');
    console.log('');

    const modes = ['quick', 'standard', 'deep', 'full-aml', 'credit'];
    const modeDescs = ['Identity+Legal+Risk ~2m', '+Social+Digital ~5m', 'All 7 agents ~15m', 'Extended AML ~30m', 'Credit focus ~10m'];
    console.log(COLORS.cyan(`  ${ICONS.arrow} `) + COLORS.bright('Investigation Mode'));
    modes.forEach((m, i) => {
      const marker = i === 1 ? COLORS.cyan(`  ${ICONS.arrowR} `) : '    ';
      console.log(marker + chalk.bold(`[${i + 1}]`) + ` ${m} ` + COLORS.dimGray(modeDescs[i]));
    });
    const modeA = await new Promise(r => rl.question(COLORS.cyan('  Choice › '), r));
    const modeIdx = parseInt(modeA, 10) - 1;
    const mode = (modeIdx >= 0 && modeIdx < 5) ? modes[modeIdx] : 'standard';
    console.log('');

    const fmts = ['json', 'html', 'pdf', 'xlsx'];
    console.log(COLORS.cyan(`  ${ICONS.arrow} `) + COLORS.bright('Output Format'));
    fmts.forEach((f, i) => console.log(`    [${i + 1}] ${f}`));
    const fmtA = await new Promise(r => rl.question(COLORS.cyan('  Choice › '), r));
    const fmtIdx = parseInt(fmtA, 10) - 1;
    const outputFormat = (fmtIdx >= 0 && fmtIdx < 4) ? fmts[fmtIdx] : 'json';
    console.log('');

    const target = { name, type, country, idNumber: idNumber || undefined, company: company || undefined, email: email || undefined, phone: phone || undefined };

    // Summary box
    console.log(COLORS.cyan('  ╔════════════════════════════════════════╗'));
    console.log(COLORS.cyan('  ║') + COLORS.bright.bold(' 📋 CONFIRM ') + COLORS.cyan('║'));
    console.log(COLORS.cyan('  ╠════════════════════════════════════════╣'));
    console.log(COLORS.cyan('  ║') + `  Target:  ${COLORS.cyan(name)}`.padEnd(50) + COLORS.cyan('║'));
    console.log(COLORS.cyan('  ║') + `  Type:    ${type}`.padEnd(41) + COLORS.cyan('║'));
    console.log(COLORS.cyan('  ║') + `  Mode:    ${COLORS.cyan(mode)}`.padEnd(50) + COLORS.cyan('║'));
    console.log(COLORS.cyan('  ║') + `  Output:  ${outputFormat}`.padEnd(41) + COLORS.cyan('║'));
    console.log(COLORS.cyan('  ╚════════════════════════════════════════╝'));
    console.log('');

    const confirm = await ask(rl, 'Proceed? (Y/n)', 'Y');
    rl.close();

    if (confirm.toLowerCase() === 'n') { console.log(COLORS.warning('  Cancelled.')); process.exit(0); }
    return { target, mode, outputFormat };
  } finally {
    rl.close();
  }
}
