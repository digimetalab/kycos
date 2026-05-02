/**
 * @fileoverview Tests for Orchestrator investigation coordination.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// We mock the dependencies to test orchestrator logic in isolation
vi.mock('../../src/core/ai-router.js', () => ({
  routeJSON: vi.fn().mockResolvedValue({
    data: { agents: ['identity', 'legal', 'risk'], priority: {}, specialInstructions: {} },
    provider: 'mock',
    model: 'mock-model',
  }),
}));

vi.mock('../../src/core/memory.js', () => ({
  createInvestigation: vi.fn(() => '00000000-0000-0000-0000-000000000001'),
  storePlan: vi.fn(),
  completeInvestigation: vi.fn(),
  getInvestigation: vi.fn(),
  initMemory: vi.fn(),
}));

vi.mock('../../src/core/pipeline.js', () => ({
  runPipeline: vi.fn().mockResolvedValue({
    results: [
      { agent: 'identity', status: 'success', confidence: 0.9, data: {}, redFlags: [], sources: [], executionMs: 100 },
      { agent: 'legal', status: 'success', confidence: 0.85, data: {}, redFlags: [], sources: [], executionMs: 150 },
      { agent: 'risk', status: 'success', confidence: 0.8, data: { scorecard: { totalScore: 720 } }, redFlags: [], sources: [], executionMs: 200 },
    ],
    succeeded: 3,
    failed: 0,
    partial: 0,
    totalMs: 500,
  }),
}));

describe('Orchestrator', () => {
  it('should be importable', async () => {
    const mod = await import('../../src/core/orchestrator.js');
    expect(mod.investigate).toBeDefined();
    expect(typeof mod.investigate).toBe('function');
  });

  it('has getReport function', async () => {
    const mod = await import('../../src/core/orchestrator.js');
    expect(mod.getReport).toBeDefined();
  });
});
