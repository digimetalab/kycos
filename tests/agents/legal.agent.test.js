/**
 * @fileoverview Tests for Legal Agent.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LegalAgent } from '../../src/agents/legal.agent.js';

vi.mock('../../src/core/ai-router.js', () => ({
  routeCompletion: vi.fn(),
  routeJSON: vi.fn().mockResolvedValue({
    data: {
      sanctionsCheck: { match: false, lists: ['OFAC', 'UN', 'EU'], closestMatch: null },
      pepStatus: { isPEP: false, level: null, position: null },
      courtRecords: { found: false, cases: [] },
      businessRegistration: { registered: true, status: 'active', details: 'Valid registration' },
      riskAssessment: 'low',
    },
    provider: 'mock',
    model: 'mock',
  }),
}));

describe('LegalAgent', () => {
  let agent;

  beforeEach(() => {
    agent = new LegalAgent();
  });

  it('has correct name', () => {
    expect(agent.name).toBe('legal');
  });

  it('handles clean results', async () => {
    const result = await agent.execute({ name: 'Clean Person' }, {});
    expect(result.status).toBe('success');
  });
});
