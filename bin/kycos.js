#!/usr/bin/env node

/**
 * @fileoverview KYCOS CLI — KYC OSINT Multi-Agent Intelligence System.
 * Futuristic terminal interface with animated logo, interactive input,
 * real-time agent dashboard, and styled results display.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

// ─── CLI Program ───────────────────────────────────────────────

const program = new Command();

program
  .name('kycos')
  .description('KYC OSINT Multi-Agent Intelligence System')
  .version(pkg.version);

// ─── investigate (with interactive mode) ───────────────────────

program
  .command('investigate')
  .description('Run a KYC/AML/OSINT investigation on a target')
  .option('-t, --target <name>', 'Target name (skip interactive mode)')
  .option('-m, --mode <mode>', 'Investigation mode', 'standard')
  .option('--type <type>', 'Target type: individual or corporation', 'individual')
  .option('--country <code>', 'Country code (ISO 3166)', 'ID')
  .option('--id <number>', 'ID number (KTP/NPWP/Passport)')
  .option('--company <name>', 'Company name')
  .option('--email <email>', 'Email address')
  .option('--phone <phone>', 'Phone number')
  .option('--output <format>', 'Output format: json|html|pdf|xlsx|md', 'md')
  .option('--verbose', 'Show detailed agent output', false)
  .option('--no-animate', 'Skip logo animation')
  .addHelpText('after', `
${chalk.bold('Modes:')}
  quick      Identity + Legal + Risk (~2 min)
  standard   + Social + Digital (~5 min)
  deep       All 7 agents (~15 min)
  full-aml   All agents, extended AML (~30 min)
  credit     Identity + Financial + Legal + Network + Risk (~10 min)

${chalk.bold('Examples:')}
  $ kycos investigate                               # Interactive mode
  $ kycos investigate -t "John Doe" -m quick         # Direct mode
  $ kycos investigate -t "PT Maju" --type corporation --output pdf
  `)
  .action(async (options) => {
    // 1. Show animated logo
    const { printLogo } = await import('../src/ui/logo.js');
    await printLogo({ animate: options.animate !== false });

    let target, mode, outputFormat;

    // 2. Interactive mode (no --target flag)
    if (!options.target) {
      const { interactiveInput } = await import('../src/ui/input.js');
      const input = await interactiveInput();
      target = input.target;
      mode = input.mode;
      outputFormat = input.outputFormat;
    } else {
      // Direct mode from CLI args
      target = {
        name: options.target, type: options.type, country: options.country,
        idNumber: options.id, company: options.company,
        email: options.email, phone: options.phone,
      };
      mode = options.mode;
      outputFormat = options.output;
    }

    // 3. Validate mode
    const validModes = ['quick', 'standard', 'deep', 'full-aml', 'credit'];
    if (!validModes.includes(mode)) {
      const { COLORS } = await import('../src/ui/theme.js');
      console.log(COLORS.error(`  ✗ Invalid mode "${mode}". Valid: ${validModes.join(', ')}`));
      process.exit(1);
    }

    // 4. Init services
    const { initMemory } = await import('../src/core/memory.js');
    const { initCache } = await import('../src/services/cache.js');
    const { initInvestigationDB, saveInvestigation, saveReportRecord } = await import('../src/services/investigation-db.js');
    const { startInvestigationLog, logPipelineStart, finalizeLog } = await import('../src/services/file-logger.js');
    initMemory();
    initCache();
    initInvestigationDB();

    // 5. Run investigation with dashboard
    try {
      const { investigate } = await import('../src/core/orchestrator.js');
      const { createDashboard } = await import('../src/ui/dashboard.js');
      const { printResults } = await import('../src/ui/results.js');
      const { investigationModes } = await import('../kycos.config.js');

      // Determine which agents will run
      const modeConfig = investigationModes[mode];
      const agentNames = modeConfig?.agents || ['identity', 'legal', 'risk'];

      // Create and start dashboard
      const dashboard = createDashboard(agentNames);
      dashboard.start();

      // Start file logging
      const logPath = startInvestigationLog('pre-' + Date.now(), target, mode);
      logPipelineStart(agentNames.length);

      const report = await investigate(target, mode, { verbose: options.verbose, dashboard });

      dashboard.stop();

      // Finalize log
      finalizeLog(report);

      // Save to SQLite DB
      try {
        saveInvestigation(report);
      } catch (dbErr) {
        console.log(COLORS.warning(`  ⚠ DB save: ${dbErr.message}`));
      }

      // 6. Show results
      const { COLORS } = await import('../src/ui/theme.js');
      printResults(report);

      // 7. Always generate MD report
      const { generateMarkdownReport } = await import('../src/reports/md-report.js');
      const mdResult = generateMarkdownReport(report);
      console.log(COLORS.success(`  ✓ MD Report: ${mdResult.filePath} (${(mdResult.fileSize / 1024).toFixed(1)}KB)`));
      try { saveReportRecord(report.planId || report.id, 'md', mdResult.filePath, mdResult.fileSize); } catch {}

      // 8. Additional format export
      if (outputFormat !== 'md') {
        await exportReport(report, outputFormat, target.name);
      }

      console.log(COLORS.success(`  ✓ Log file: ${logPath}`));
      console.log('');
      process.exit(0);
    } catch (err) {
      const { COLORS } = await import('../src/ui/theme.js');
      console.log(COLORS.error(`\n  ✗ Investigation failed: ${err.message}`));
      if (options.verbose) console.error(err.stack);
      process.exit(1);
    }
  });

// ─── batch ─────────────────────────────────────────────────────

program
  .command('batch')
  .description('Run batch investigations from a CSV file')
  .requiredOption('-i, --input <csv>', 'Input CSV file path')
  .option('-m, --mode <mode>', 'Investigation mode', 'standard')
  .option('--output <format>', 'Output format', 'json')
  .option('--concurrency <n>', 'Max concurrent investigations', '2')
  .action(async (options) => {
    const { printHeader } = await import('../src/ui/logo.js');
    const { COLORS } = await import('../src/ui/theme.js');
    const { withSpinner } = await import('../src/utils/spinner.js');
    printHeader('Batch Processing');

    try {
      const csv = readFileSync(options.input, 'utf-8');
      const lines = csv.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const targets = lines.slice(1).map(line => {
        const values = line.split(',');
        const t = {};
        headers.forEach((h, i) => { t[h] = values[i]?.trim(); });
        return t;
      });

      console.log(COLORS.success(`  ✓ Loaded ${targets.length} targets from ${options.input}`));

      const { initMemory } = await import('../src/core/memory.js');
      const { initCache } = await import('../src/services/cache.js');
      const { investigate } = await import('../src/core/orchestrator.js');
      initMemory();
      initCache();

      const concurrency = parseInt(options.concurrency, 10) || 2;
      const results = [];

      for (let i = 0; i < targets.length; i += concurrency) {
        const batch = targets.slice(i, i + concurrency);
        console.log(COLORS.cyan(`\n  ${COLORS.bright(`Batch ${Math.floor(i / concurrency) + 1}`)}: Processing ${batch.length} targets...`));
        const batchResults = await Promise.allSettled(batch.map(t => investigate(t, options.mode)));
        results.push(...batchResults);
      }

      const ok = results.filter(r => r.status === 'fulfilled').length;
      console.log(COLORS.success(`\n  ✓ Batch complete: ${ok}/${targets.length} succeeded`));
    } catch (err) {
      console.log(COLORS.error(`  ✗ Batch failed: ${err.message}`));
      process.exit(1);
    }
  });

// ─── report ────────────────────────────────────────────────────

program
  .command('report')
  .description('Generate a report from a completed investigation')
  .requiredOption('-c, --case <id>', 'Investigation case ID')
  .option('-f, --format <format>', 'Output: pdf|json|html|xlsx', 'pdf')
  .option('--template <name>', 'Report template', 'investigation')
  .action(async (options) => {
    const { printHeader } = await import('../src/ui/logo.js');
    const { COLORS } = await import('../src/ui/theme.js');
    printHeader('Report Generator');

    const { initMemory, getInvestigation } = await import('../src/core/memory.js');
    initMemory();

    const investigation = getInvestigation(options.case);
    if (!investigation) {
      console.log(COLORS.error(`  ✗ Case ${options.case} not found`));
      process.exit(1);
    }

    console.log(COLORS.cyan(`  Generating ${options.format.toUpperCase()} for case ${options.case.slice(0, 8)}...`));
    await exportReport(investigation, options.format, 'case-' + options.case.slice(0, 8));
  });

// ─── config ────────────────────────────────────────────────────

program
  .command('config')
  .description('Configure KYCOS settings')
  .option('--setup', 'Run setup wizard')
  .option('--show', 'Show current configuration')
  .option('--check', 'Verify API keys and connectivity')
  .action(async (options) => {
    const { printHeader } = await import('../src/ui/logo.js');
    printHeader('Configuration');

    if (options.show) {
      const config = await import('../kycos.config.js');
      console.log(JSON.stringify(config.default || config, null, 2));
      return;
    }

    if (options.check) {
      const { printProviderStatus } = await import('../src/ui/results.js');
      const { isOllamaAvailable } = await import('../src/core/ai-clients.js');
      const { COLORS } = await import('../src/ui/theme.js');

      printProviderStatus();

      // Ollama check
      try {
        const ok = await isOllamaAvailable();
        console.log(`  🦙 Ollama: ${ok ? COLORS.green('● RUNNING') : COLORS.dimGray('○ Not detected')}`);
      } catch {
        console.log(`  🦙 Ollama: ${COLORS.dimGray('○ Not detected')}`);
      }
      console.log('');
      return;
    }

    if (options.setup) {
      const { COLORS } = await import('../src/ui/theme.js');
      console.log(COLORS.bright('  📋 Setup Instructions:'));
      console.log(COLORS.text('  1. Copy .env.example → .env'));
      console.log(COLORS.text('  2. Fill in your API keys'));
      console.log(COLORS.text('  3. Run: kycos config --check'));
      console.log('');
      return;
    }

    program.commands.find(c => c.name() === 'config').help();
  });

// ─── cache ─────────────────────────────────────────────────────

program
  .command('cache')
  .description('Manage the investigation cache')
  .option('--clear', 'Clear all cached data')
  .option('--stats', 'Show cache statistics')
  .option('--purge', 'Remove expired entries')
  .action(async (options) => {
    const { printHeader } = await import('../src/ui/logo.js');
    const { COLORS } = await import('../src/ui/theme.js');
    printHeader('Cache Management');

    const { initCache, cacheInvalidate, cacheStats, cachePurge } = await import('../src/services/cache.js');
    initCache();

    if (options.clear) {
      cacheInvalidate();
      console.log(COLORS.success('  ✓ Cache cleared'));
    } else if (options.stats) {
      const stats = cacheStats();
      console.log(COLORS.bright('  Cache Statistics:'));
      console.log(`  Total:   ${COLORS.cyan(String(stats.totalEntries))}`);
      console.log(`  Active:  ${COLORS.green(String(stats.activeEntries))}`);
      console.log(`  Expired: ${COLORS.dimGray(String(stats.expiredEntries))}`);
    } else if (options.purge) {
      const n = cachePurge();
      console.log(COLORS.success(`  ✓ Purged ${n} expired entries`));
    } else {
      program.commands.find(c => c.name() === 'cache').help();
    }
    console.log('');
  });

// ─── history ───────────────────────────────────────────────────

program
  .command('history')
  .description('View past investigation history from database')
  .option('-n, --limit <n>', 'Number of records', '20')
  .option('-s, --search <query>', 'Search by target name')
  .option('--stats', 'Show database statistics')
  .action(async (options) => {
    const { printHeader } = await import('../src/ui/logo.js');
    const { COLORS } = await import('../src/ui/theme.js');
    printHeader('Investigation History');

    const { initInvestigationDB, listInvestigations, searchInvestigations, getDBStats } = await import('../src/services/investigation-db.js');
    initInvestigationDB();

    if (options.stats) {
      const stats = getDBStats();
      console.log(COLORS.bright('  Database Statistics:'));
      console.log(`  Investigations: ${COLORS.cyan(String(stats.invCount))}`);
      console.log(`  Red Flags:      ${COLORS.yellow(String(stats.flagCount))}`);
      console.log(`  Reports:        ${COLORS.green(String(stats.reportCount))}`);
      console.log(`  Avg Score:      ${COLORS.cyan(String(stats.avgScore) + '/850')}`);
      if (stats.byDecision.length > 0) {
        console.log(COLORS.bright('\n  Decisions:'));
        for (const d of stats.byDecision) console.log(`    ${d.decision}: ${d.c}`);
      }
      console.log('');
      return;
    }

    const investigations = options.search
      ? searchInvestigations(options.search)
      : listInvestigations(parseInt(options.limit, 10) || 20);

    if (investigations.length === 0) {
      console.log(COLORS.dimGray('  No investigations found.'));
      return;
    }

    console.log(COLORS.bright(`  Found ${investigations.length} investigation(s):\n`));
    console.log(COLORS.dimGray('  ID       │ Target              │ Decision │ Score │ Risk     │ Flags │ Date'));
    console.log(COLORS.dimGray('  ─────────┼─────────────────────┼──────────┼───────┼──────────┼───────┼─────────────'));
    for (const inv of investigations) {
      const id = (inv.id || '').slice(0, 8);
      const name = (inv.target_name || '').padEnd(19).slice(0, 19);
      const dec = (inv.decision || '—').padEnd(8);
      const score = String(inv.overall_score || 0).padEnd(5);
      const risk = (inv.overall_risk || '—').padEnd(8);
      const flags = String(inv.total_red_flags || 0).padEnd(5);
      const date = inv.created_at || '—';
      console.log(`  ${id} │ ${name} │ ${dec} │ ${score} │ ${risk} │ ${flags} │ ${date}`);
    }
    console.log('');
  });

// ─── Export Helper ─────────────────────────────────────────────

async function exportReport(report, format, nameHint) {
  const { COLORS } = await import('../src/ui/theme.js');
  if (!existsSync('./report')) mkdirSync('./report', { recursive: true });
  const slug = (nameHint || 'report').replace(/\s+/g, '_');
  const ts = Date.now();

  try {
    if (format === 'md') {
      // MD is already generated in the main flow
      return;
    } else if (format === 'json') {
      const p = `./report/kycos-${slug}-${ts}.json`;
      writeFileSync(p, JSON.stringify(report, null, 2));
      console.log(COLORS.success(`  ✓ JSON saved: ${p}`));
    } else if (format === 'html') {
      const { renderReport, ensureOutputDir } = await import('../src/reports/report-engine.js');
      ensureOutputDir();
      const html = renderReport(report);
      const p = `./report/kycos-${slug}-${ts}.html`;
      writeFileSync(p, html);
      console.log(COLORS.success(`  ✓ HTML saved: ${p}`));
    } else if (format === 'pdf') {
      const { generatePDF } = await import('../src/reports/pdf-generator.js');
      const p = await generatePDF(report);
      console.log(COLORS.success(`  ✓ PDF saved: ${p}`));
    } else if (format === 'xlsx') {
      const { generateXLSX } = await import('../src/reports/xlsx-generator.js');
      const p = await generateXLSX(report);
      console.log(COLORS.success(`  ✓ XLSX saved: ${p}`));
    }
  } catch (err) {
    console.log(COLORS.error(`  ✗ Export failed: ${err.message}`));
  }
  console.log('');
}

// ─── Parse ─────────────────────────────────────────────────────

program.parse();

// Default: show logo + help if no command
if (!process.argv.slice(2).length) {
  (async () => {
    const { printLogo } = await import('../src/ui/logo.js');
    await printLogo({ animate: true });
    program.outputHelp();
  })();
}
