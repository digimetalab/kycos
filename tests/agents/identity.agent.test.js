/**
 * @fileoverview Tests for Identity Agent.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IdentityAgent } from '../../src/agents/identity.agent.js';

vi.mock('../../src/core/ai-router.js', () => ({
  routeCompletion: vi.fn(),
  routeJSON: vi.fn().mockResolvedValue({
    data: {
      fullName: 'John Doe',
      aliases: ['J. Doe'],
      idValidation: { format: 'valid', type: 'KTP', details: '16-digit valid' },
      nameMatches: [],
      photoOsint: { available: false, reverseSearchResults: [] },
      verificationStatus: 'verified',
      riskIndicators: [],
    },
    provider: 'mock',
    model: 'mock',
  }),
}));

describe('IdentityAgent', () => {
  let agent;

  beforeEach(() => {
    agent = new IdentityAgent();
  });

  it('has correct name and taskType', () => {
    expect(agent.name).toBe('identity');
    expect(agent.taskType).toBe('data_extraction');
  });

  it('returns success result for verified identity', async () => {
    const result = await agent.execute({ name: 'John Doe', type: 'individual' }, {});
    expect(result.status).toBe('success');
    expect(result.confidence).toBe(0.85);
    expect(result.data.verificationStatus).toBe('verified');
    expect(result.redFlags).toHaveLength(0);
  });
});
