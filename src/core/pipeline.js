/**
 * @fileoverview KYCOS Pipeline — parallel agent execution engine.
 * Dispatches agents via Promise.allSettled() with error boundaries,
 * progress tracking, and result aggregation.
 */

import { createLogger } from '../utils/logger.js';
import { storeAgentResult } from './memory.js';
import chalk from 'chalk';

const logger = createLogger('Pipeline');

/**
 * Run multiple agents in parallel with error isolation.
 *
 * @param {import('./base-agent.js').BaseAgent[]} agents - Agent instances
 * @param {Object} target - Investigation target
 * @param {Object} context - Shared investigation context
 * @param {string} investigationId - ID for result storage
 * @param {Object} [options={}] - Pipeline options
 * @param {number} [options.timeoutMs=120000] - Per-agent timeout
 * @param {boolean} [options.verbose=false] - Verbose logging
 * @param {Object} [options.dashboard=null] - Dashboard controller for UI updates
 * @returns {Promise<Object>} Pipeline result
 */
export async function runPipeline(agents, target, context, investigationId, options = {}) {
  const { timeoutMs = 120_000, verbose = false, dashboard = null } = options;
  const startMs = performance.now();

  logger.info(`Pipeline starting: ${agents.length} agents for "${target.name}"`);

  // Notify dashboard of agent starts
  if (dashboard) {
    for (const agent of agents) {
      dashboard.agentStarted(agent.name);
    }
  }

  // Wrap each agent with dashboard callbacks
  const agentPromises = agents.map(agent => {
    return executeWithBoundary(agent, target, context, timeoutMs).then(result => {
      if (dashboard) dashboard.agentCompleted(agent.name, result);
      return { agentName: agent.name, result };
    });
  });

  // Run all in parallel — Promise.allSettled never throws
  const settled = await Promise.allSettled(agentPromises);

  // Process results
  const results = [];
  let succeeded = 0;
  let failed = 0;
  let partial = 0;

  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    const agentName = agents[i].name;

    if (outcome.status === 'fulfilled') {
      const { result } = outcome.value;
      results.push(result);

      try { storeAgentResult(investigationId, result); } catch (err) {
        logger.warn(`Failed to store result for ${agentName}: ${err.message}`);
      }

      if (result.status === 'success') succeeded++;
      else if (result.status === 'partial') partial++;
      else failed++;

      if (verbose) {
        logger.info(`${agentName}: ${result.status} | confidence: ${result.confidence} | flags: ${result.redFlags.length}`);
      }
    } else {
      failed++;
      const errorResult = createErrorResult(agentName, outcome.reason);
      results.push(errorResult);
      if (dashboard) dashboard.agentCompleted(agentName, errorResult);
      try { storeAgentResult(investigationId, errorResult); } catch { /* ignore */ }
    }
  }

  const totalMs = Math.round(performance.now() - startMs);

  // Log summary
  const totalFlags = results.reduce((sum, r) => sum + (r.redFlags?.length || 0), 0);
  if (totalFlags > 0) {
    const criticalFlags = results.flatMap(r => r.redFlags || []).filter(f => f.severity === 'critical');
    logger.flag(
      criticalFlags.length > 0 ? 'critical' : 'medium',
      `${totalFlags} red flags detected (${criticalFlags.length} critical)`
    );
  }

  logger.info(`Pipeline complete: ${succeeded}✓ ${partial}◐ ${failed}✗ in ${totalMs}ms`);

  return { results, succeeded, failed, partial, totalMs };
}

/**
 * Execute a single agent with error boundary and timeout.
 */
async function executeWithBoundary(agent, target, context, timeoutMs) {
  try {
    const result = await Promise.race([
      agent.run(target, context),
      createTimeout(timeoutMs, agent.name),
    ]);
    return result;
  } catch (err) {
    logger.error(`Agent ${agent.name} threw: ${err.message}`);
    return agent.handleError(err);
  }
}

function createTimeout(ms, agentName) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Agent "${agentName}" timed out after ${ms}ms`)), ms);
  });
}

function createErrorResult(agentName, error) {
  return {
    agent: agentName, status: 'failed', confidence: 0,
    data: { error: error?.message || 'Unknown error' },
    redFlags: [], sources: [], executionMs: 0,
  };
}
