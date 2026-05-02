/**
 * @fileoverview Tests for Network Analysis Agent.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NetworkAgent } from '../../src/agents/network.agent.js';

vi.mock('../../src/core/ai-router.js', () => ({
  routeCompletion: vi.fn(),
  routeJSON: vi.fn().mockResolvedValue({
    data: {
      entities: [{ name: 'PT Test Corp', type: 'corporation', role: 'target' }],
      relationships: [],
      beneficialOwners: [{ name: 'John Doe', ownership: 0.75, direct: true }],
      crossDirectorships: [],
      riskIndicators: [],
    },
    provider: 'mock',
    model: 'mock',
  }),
}));

describe('NetworkAgent', () => {
  let agent;

  beforeEach(() => {
    agent = new NetworkAgent();
  });

  it('has correct name', () => {
    expect(agent.name).toBe('network');
    expect(agent.taskType).toBe('pattern_matching');
  });

  it('handles clean network', async () => {
    const result = await agent.execute({ name: 'PT Test Corp', type: 'corporation' }, {});
    expect(result.status).toBe('success');
  });
});
