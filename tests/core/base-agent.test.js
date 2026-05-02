/**
 * @fileoverview Tests for BaseAgent abstract class.
 */

import { describe, it, expect, vi } from 'vitest';
import { BaseAgent } from '../../src/core/base-agent.js';

// Concrete implementation for testing
class TestAgent extends BaseAgent {
  constructor(overrides = {}) {
    super({
      name: 'test',
      displayName: 'Test Agent',
      taskType: 'cost_sensitive',
      systemPrompt: 'You are a test agent.',
      tools: [],
      ...overrides,
    });
  }

  async execute(target, context) {
    return this.formatResult(
      { analyzed: true, target: target.name },
      { redFlags: [], sources: ['test-source'], confidence: 0.9 }
    );
  }
}

describe('BaseAgent', () => {
  it('throws when instantiated directly', () => {
    expect(() => new BaseAgent({
      name: 'test', displayName: 'Test', taskType: 'cost_sensitive',
      systemPrompt: 'test', tools: [],
    })).toThrow('abstract');
  });

  it('creates instance via subclass', () => {
    const agent = new TestAgent();
    expect(agent.name).toBe('test');
    expect(agent.displayName).toBe('Test Agent');
  });

  it('formatResult returns standardized AgentResult', () => {
    const agent = new TestAgent();
    const result = agent.formatResult(
      { foo: 'bar' },
      { redFlags: [{ severity: 'high', description: 'test' }], confidence: 0.8 }
    );

    expect(result.agent).toBe('test');
    expect(result.status).toBe('success');
    expect(result.confidence).toBe(0.8);
    expect(result.data.foo).toBe('bar');
    expect(result.redFlags).toHaveLength(1);
  });

  it('clamps confidence to [0, 1]', () => {
    const agent = new TestAgent();
    expect(agent.formatResult({}, { confidence: 1.5 }).confidence).toBe(1);
    expect(agent.formatResult({}, { confidence: -0.5 }).confidence).toBe(0);
  });

  it('handleError returns failed result', () => {
    const agent = new TestAgent();
    const result = agent.handleError(new Error('test error'));
    expect(result.status).toBe('failed');
    expect(result.confidence).toBe(0);
    expect(result.data.error).toBe('test error');
  });

  it('handleError returns partial when partial data provided', () => {
    const agent = new TestAgent();
    const result = agent.handleError(new Error('partial fail'), { partial: true });
    expect(result.status).toBe('partial');
    expect(result.confidence).toBe(0.2);
  });

  it('run() wraps execute with timing', async () => {
    const agent = new TestAgent();
    const result = await agent.run({ name: 'Test Target' }, {});
    expect(result.status).toBe('success');
    expect(result.executionMs).toBeGreaterThanOrEqual(0);
    expect(result.data.target).toBe('Test Target');
  });

  it('run() handles execute throwing', async () => {
    class FailAgent extends BaseAgent {
      constructor() {
        super({ name: 'fail', displayName: 'Fail', taskType: 'cost_sensitive', systemPrompt: '', tools: [] });
      }
      async execute() { throw new Error('boom'); }
    }

    const agent = new FailAgent();
    const result = await agent.run({ name: 'Test' }, {});
    expect(result.status).toBe('failed');
    expect(result.data.error).toBe('boom');
  });
});
