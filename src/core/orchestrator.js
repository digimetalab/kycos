/**
 * @fileoverview KYCOS Orchestrator — investigation coordinator.
 * Takes a target, generates an LLM investigation plan, dispatches
 * agents via the pipeline, and aggregates results.
 */

import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';
import { routeJSON } from './ai-router.js';
import { runPipeline } from './pipeline.js';
import { createInvestigation, storePlan, completeInvestigation, getInvestigation } from './memory.js';
import { investigationModes } from '../../kycos.config.js';
import { createLogger } from '../utils/logger.js';
import { IdentityAgent } from '../agents/identity.agent.js';
import { SocialAgent } from '../agents/social.agent.js';
import { FinancialAgent } from '../agents/financial.agent.js';
import { LegalAgent } from '../agents/legal.agent.js';
import { DigitalAgent } from '../agents/digital.agent.js';
import { NetworkAgent } from '../agents/network.agent.js';
import { RiskAgent } from '../agents/risk.agent.js';

const logger = createLogger('Orchestrator');

/** Agent registry — maps names to constructors */
const AGENT_REGISTRY = {
  identity:  IdentityAgent,
  social:    SocialAgent,
  financial: FinancialAgent,
  legal:     LegalAgent,
  digital:   DigitalAgent,
  network:   NetworkAgent,
  risk:      RiskAgent,
};

/**
 * Run a full investigation on a target.
 * @param {Object} target - Investigation target { name, type, country, ... }
 * @param {string} mode - Investigation mode (quick|standard|deep|full-aml|credit)
 * @param {Object} [options={}] - Additional options
 * @returns {Promise<Object>} Complete investigation report
 */
export async function investigate(target, mode = 'standard', options = {}) {
  const startMs = performance.now();

  logger.info(chalk.bold(`\n${'═'.repeat(60)}`));
  logger.info(chalk.bold.cyan(`  KYCOS Investigation: "${target.name}"`));
  logger.info(chalk.bold(`  Mode: ${mode} | Type: ${target.type || 'individual'}`));
  logger.info(chalk.bold(`${'═'.repeat(60)}\n`));

  // 1. Create investigation record
  const investigationId = createInvestigation(target, mode);
  logger.info(`Investigation ID: ${chalk.yellow(investigationId.slice(0, 8))}`);

  // 2. Generate investigation plan via LLM
  const plan = await generatePlan(target, mode, investigationId);
  storePlan(investigationId, plan);

  // 3. Instantiate selected agents
  const agents = instantiateAgents(plan.agents);
  logger.info(`Dispatching ${chalk.cyan(agents.length)} agents: ${agents.map(a => a.name).join(', ')}`);

  // 4. Run pipeline (parallel execution)
  const pipelineResult = await runPipeline(agents, target, { plan, investigationId }, investigationId, options);

  // 5. Aggregate and score
  const report = aggregateResults(investigationId, target, mode, plan, pipelineResult);
  report.executionMs = Math.round(performance.now() - startMs);

  // 6. Complete investigation
  completeInvestigation(investigationId, 'completed');

  // 7. Print summary (skip if dashboard UI is handling display)
  if (!options.dashboard) {
    printSummary(report);
  }

  return report;
}

/**
 * Generate an investigation plan using LLM.
 * @param {Object} target
 * @param {string} mode
 * @param {string} investigationId
 * @returns {Promise<Object>}
 */
async function generatePlan(target, mode, investigationId) {
  const modeConfig = investigationModes[mode];
  if (!modeConfig) throw new Error(`Unknown investigation mode: ${mode}`);

  // Try LLM planning, fall back to static plan
  try {
    const { data } = await routeJSON({
      taskType: 'cost_sensitive',
      systemPrompt: 'You are an investigation planner. Given a target and mode, produce a JSON investigation plan.',
      userMessage: `Plan investigation for: ${JSON.stringify(target)}
Mode: ${mode} (agents available: ${modeConfig.agents.join(', ')})
Return JSON: { "agents": [...], "priority": {"agent": number}, "specialInstructions": {"agent": "instruction"} }`,
    });

    return {
      id: investigationId,
      target,
      mode,
      agents: data.agents || modeConfig.agents,
      priority: data.priority || {},
      specialInstructions: data.specialInstructions || {},
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.warn(`LLM planning failed, using static plan: ${err.message}`);
    return {
      id: investigationId,
      target,
      mode,
      agents: modeConfig.agents,
      priority: {},
      specialInstructions: {},
      createdAt: new Date().toISOString(),
    };
  }
}

/**
 * Instantiate agent classes from a list of agent names.
 * @param {string[]} agentNames
 * @returns {import('../agents/base.agent.js').BaseAgent[]}
 */
function instantiateAgents(agentNames) {
  return agentNames
    .filter(name => AGENT_REGISTRY[name])
    .map(name => new AGENT_REGISTRY[name]());
}

/**
 * Aggregate pipeline results into a final investigation report.
 */
function aggregateResults(investigationId, target, mode, plan, pipelineResult) {
  const { results } = pipelineResult;

  const allFlags = results.flatMap(r => r.redFlags || []);
  const criticalFlags = allFlags.filter(f => f.severity === 'critical');
  const highFlags = allFlags.filter(f => f.severity === 'high');

  // Determine overall risk
  let overallRisk = 'low';
  if (criticalFlags.length > 0) overallRisk = 'critical';
  else if (highFlags.length > 0) overallRisk = 'high';
  else if (allFlags.length > 3) overallRisk = 'medium';

  // Get risk agent score if available
  const riskResult = results.find(r => r.agent === 'risk');
  const overallScore = riskResult?.data?.scorecard?.totalScore ?? 500;

  // Decision logic
  let decision = 'APPROVE';
  if (criticalFlags.length > 0 || overallScore < 450) decision = 'REJECT';
  else if (highFlags.length > 0 || overallScore < 600) decision = 'EDD';

  return {
    id: uuidv4(),
    planId: investigationId,
    target,
    mode,
    results,
    overallRisk,
    overallScore,
    decision,
    totalRedFlags: allFlags.length,
    pipelineStats: {
      succeeded: pipelineResult.succeeded,
      failed: pipelineResult.failed,
      partial: pipelineResult.partial,
    },
    completedAt: new Date().toISOString(),
    executionMs: 0,
  };
}

/**
 * Print a styled investigation summary to the terminal.
 */
function printSummary(report) {
  const decisionColors = { APPROVE: chalk.green, EDD: chalk.yellow, REJECT: chalk.red };
  const riskColors = { low: chalk.green, medium: chalk.yellow, high: chalk.red, critical: chalk.bgRed.white };
  const decisionFn = decisionColors[report.decision] || chalk.white;
  const riskFn = riskColors[report.overallRisk] || chalk.white;

  console.log(chalk.bold(`\n${'═'.repeat(60)}`));
  console.log(chalk.bold.cyan('  INVESTIGATION SUMMARY'));
  console.log(chalk.bold(`${'═'.repeat(60)}`));
  console.log(`  Target:      ${chalk.white.bold(report.target.name)}`);
  console.log(`  Mode:        ${report.mode}`);
  console.log(`  Decision:    ${decisionFn.bold(report.decision)}`);
  console.log(`  Risk Level:  ${riskFn(report.overallRisk.toUpperCase())}`);
  console.log(`  Score:       ${report.overallScore}/850`);
  console.log(`  Red Flags:   ${report.totalRedFlags}`);
  console.log(`  Agents:      ${report.pipelineStats.succeeded}✓ ${report.pipelineStats.partial}◐ ${report.pipelineStats.failed}✗`);
  console.log(`  Duration:    ${report.executionMs}ms`);
  console.log(chalk.bold(`${'═'.repeat(60)}\n`));
}

/**
 * Re-retrieve a completed investigation from memory.
 * @param {string} investigationId
 * @returns {Object|null}
 */
export function getReport(investigationId) {
  return getInvestigation(investigationId);
}
