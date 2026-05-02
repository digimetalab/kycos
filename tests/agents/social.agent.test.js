/**
 * @fileoverview Tests for Social Agent.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SocialAgent } from '../../src/agents/social.agent.js';

vi.mock('../../src/core/ai-router.js', () => ({
  routeCompletion: vi.fn(),
  routeJSON: vi.fn().mockResolvedValue({
    data: {
      profiles: [{ platform: 'LinkedIn', url: 'https://linkedin.com/in/test', verified: true, followers: 500, activity: 'active' }],
      sentiment: { overall: 'positive', score: 0.7, keyTopics: ['professional'] },
      connections: { totalMapped: 200, notableConnections: [], networkQuality: 'high' },
      activityScore: 0.8,
      lifestyleIndicators: { apparentWealth: 'medium', consistentWithProfile: true, details: 'Consistent' },
      professionalHistory: { consistent: true, gaps: [], details: 'Consistent career' },
      riskIndicators: [],
    },
    provider: 'mock',
    model: 'mock',
  }),
}));

describe('SocialAgent', () => {
  let agent;

  beforeEach(() => {
    agent = new SocialAgent();
  });

  it('has correct name', () => {
    expect(agent.name).toBe('social');
  });

  it('returns success for clean profile', async () => {
    const result = await agent.execute({ name: 'Test User' }, {});
    expect(result.status).toBe('success');
    expect(result.confidence).toBe(0.7);
    expect(result.redFlags).toHaveLength(0);
  });
});
