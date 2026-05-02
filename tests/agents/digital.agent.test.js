/**
 * @fileoverview Tests for Digital Footprint Agent.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DigitalAgent } from '../../src/agents/digital.agent.js';

vi.mock('../../src/core/ai-router.js', () => ({
  routeCompletion: vi.fn(),
  routeJSON: vi.fn().mockResolvedValue({
    data: {
      domains: [],
      shodanResults: { exposedServices: 0, vulnerabilities: [] },
      breachResults: { breached: false, breaches: [] },
      emailReputation: { score: 0.9, disposable: false },
      darkWebMentions: [],
    },
    provider: 'mock',
    model: 'mock',
  }),
}));

describe('DigitalAgent', () => {
  let agent;

  beforeEach(() => {
    agent = new DigitalAgent();
  });

  it('has correct name', () => {
    expect(agent.name).toBe('digital');
  });

  it('handles clean digital footprint', async () => {
    const result = await agent.execute({ name: 'Test', email: 'test@example.com' }, {});
    expect(result.status).toBe('success');
  });
});
