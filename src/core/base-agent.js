/**
 * @fileoverview KYCOS Base Agent — abstract base class for all specialist agents.
 * Every agent must extend this class and implement the execute() method.
 * Provides error handling, timing, result formatting, and AI routing.
 */

import { createLogger } from '../utils/logger.js';
import { routeCompletion, routeJSON } from './ai-router.js';

/**
 * @typedef {import('./schemas.js').AgentResult} AgentResult
 * @typedef {import('./schemas.js').RedFlag} RedFlag
 */

/**
 * Abstract base class for all KYCOS investigation agents.
 * Each agent specializes in one domain of KYC/AML/OSINT analysis.
 */
export class BaseAgent {
  /**
   * @param {Object} config
   * @param {string} config.name - Unique agent identifier (e.g. 'identity', 'financial')
   * @param {string} config.displayName - Human-readable name
   * @param {string} config.taskType - AI router task type for model selection
   * @param {string} config.systemPrompt - System prompt for LLM calls
   * @param {string[]} [config.tools=[]] - External tools/APIs this agent uses
   */
  constructor({ name, displayName, taskType, systemPrompt, tools = [] }) {
    if (new.target === BaseAgent) {
      throw new Error('BaseAgent is abstract — extend it, do not instantiate directly');
    }

    this.name = name;
    this.displayName = displayName;
    this.taskType = taskType;
    this.systemPrompt = systemPrompt;
    this.tools = tools;
    this.logger = createLogger(displayName);
  }

  /**
   * Execute the agent's investigation logic.
   * MUST be overridden by subclasses.
   *
   * @param {Object} target - Investigation target
   * @param {Object} context - Shared investigation context
   * @returns {Promise<AgentResult>}
   */
  async execute(target, context) {
    throw new Error(`Agent "${this.name}" must implement execute(target, context)`);
  }

  /**
   * Call the AI router for a text completion.
   * @param {string} userMessage - The prompt to send
   * @param {Object} [options={}] - Override options
   * @returns {Promise<{ content: string, provider: string, model: string }>}
   */
  async aiComplete(userMessage, options = {}) {
    return routeCompletion({
      taskType: this.taskType,
      systemPrompt: this.systemPrompt,
      userMessage,
      ...options,
    });
  }

  /**
   * Call the AI router and parse response as JSON.
   * @param {string} userMessage - The prompt to send
   * @param {Object} [options={}] - Override options
   * @returns {Promise<{ data: Object, provider: string, model: string }>}
   */
  async aiJSON(userMessage, options = {}) {
    return routeJSON({
      taskType: this.taskType,
      systemPrompt: this.systemPrompt,
      userMessage,
      ...options,
    });
  }

  /**
   * Format raw agent output into a standardized AgentResult.
   *
   * @param {Object} raw - Raw data from the agent's analysis
   * @param {Object} [opts={}]
   * @param {RedFlag[]} [opts.redFlags=[]] - Detected red flags
   * @param {string[]} [opts.sources=[]] - URLs/references used
   * @param {number} [opts.confidence=0.5] - Confidence score 0-1
   * @param {number} [opts.executionMs=0] - Execution time
   * @returns {AgentResult}
   */
  formatResult(raw, { redFlags = [], sources = [], confidence = 0.5, executionMs = 0 } = {}) {
    return {
      agent: this.name,
      status: 'success',
      confidence: Math.max(0, Math.min(1, confidence)),
      data: raw,
      redFlags,
      sources,
      executionMs,
    };
  }

  /**
   * Handle an agent error gracefully, returning a failed/partial result
   * instead of throwing and killing the pipeline.
   *
   * @param {Error} err - The error that occurred
   * @param {Object} [partialData={}] - Any partial data collected before failure
   * @returns {AgentResult}
   */
  handleError(err, partialData = {}) {
    this.logger.error(`Agent failed: ${err.message}`);
    const hasPartialData = Object.keys(partialData).length > 0;

    return {
      agent: this.name,
      status: hasPartialData ? 'partial' : 'failed',
      confidence: hasPartialData ? 0.2 : 0,
      data: {
        ...partialData,
        error: err.message,
        stack: process.env.KYCOS_LOG_LEVEL === 'debug' ? err.stack : undefined,
      },
      redFlags: [],
      sources: [],
      executionMs: 0,
    };
  }

  /**
   * Wrap the execute method with timing and error handling.
   * Called by the pipeline — agents should NOT override this.
   *
   * @param {Object} target
   * @param {Object} context
   * @returns {Promise<AgentResult>}
   */
  async run(target, context) {
    const startMs = performance.now();
    try {
      this.logger.info(`Starting analysis for "${target.name}"`);
      const result = await this.execute(target, context);
      const executionMs = Math.round(performance.now() - startMs);
      result.executionMs = executionMs;
      this.logger.timing('Completed', executionMs);

      if (result.redFlags?.length > 0) {
        for (const flag of result.redFlags) {
          this.logger.flag(flag.severity, flag.description);
        }
      }
      return result;
    } catch (err) {
      const executionMs = Math.round(performance.now() - startMs);
      const errorResult = this.handleError(err);
      errorResult.executionMs = executionMs;
      return errorResult;
    }
  }
}
