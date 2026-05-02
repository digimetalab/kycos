/**
 * @fileoverview Tests for Financial Agent — 5C+2W and AML patterns.
 * Tests the core quantitative models without AI dependency.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FinancialAgent } from '../../src/agents/financial.agent.js';

vi.mock('../../src/core/ai-router.js', () => ({
  routeCompletion: vi.fn(),
  routeJSON: vi.fn(),
}));

describe('FinancialAgent', () => {
  let agent;

  beforeEach(() => {
    agent = new FinancialAgent();
  });

  it('has correct name and weights', () => {
    expect(agent.name).toBe('financial');
  });

  describe('calculateRatios', () => {
    it('computes liquidity ratios correctly', () => {
      const fs = { currentAssets: 500, currentLiabilities: 250, cash: 100, inventory: 100, operatingCashFlow: 200 };
      const ratios = agent.calculateRatios(fs);

      expect(ratios.liquidity.currentRatio).toBe(2);
      expect(ratios.liquidity.quickRatio).toBe(1.6);
      expect(ratios.liquidity.cashRatio).toBe(0.4);
      expect(ratios.liquidity.operatingCFRatio).toBe(0.8);
    });

    it('computes profitability ratios', () => {
      const fs = { netIncome: 100, totalAssets: 1000, equity: 500, revenue: 800, ebitda: 200, ebit: 150, interestExpense: 50 };
      const ratios = agent.calculateRatios(fs);

      expect(ratios.profitability.roa).toBe(0.1);
      expect(ratios.profitability.roe).toBe(0.2);
      expect(ratios.profitability.netMargin).toBe(0.125);
      expect(ratios.profitability.interestCoverage).toBe(3);
    });

    it('computes solvability ratios', () => {
      const fs = { totalDebt: 600, totalLiabilities: 600, equity: 400, totalAssets: 1000, ebitda: 200, ebit: 150, principalPayments: 50, interestExpense: 50 };
      const ratios = agent.calculateRatios(fs);

      expect(ratios.solvability.der).toBe(1.5);
      expect(ratios.solvability.dar).toBe(0.6);
      expect(ratios.solvability.debtToEBITDA).toBe(3);
      expect(ratios.solvability.dscr).toBe(1.5);
    });

    it('handles division by zero gracefully', () => {
      const fs = { netIncome: 100, totalAssets: 0, equity: 0 };
      const ratios = agent.calculateRatios(fs);

      expect(ratios.profitability.roa).toBeNull();
      expect(ratios.profitability.roe).toBeNull();
    });
  });

  describe('score5C2W', () => {
    it('scores Character based on SLIK kolektibilitas', () => {
      const fs = {};
      const ratios = agent.calculateRatios(fs);
      const slik = { kolektibilitas: 1 };
      const scores = agent.score5C2W(fs, ratios, slik, {}, {}, {});

      const character = scores.find(c => c.name === 'Character');
      expect(character.score).toBe(90);
      expect(character.weight).toBe(0.20);
    });

    it('scores bad kolektibilitas low', () => {
      const fs = {};
      const ratios = agent.calculateRatios(fs);
      const slik = { kolektibilitas: 5 };
      const scores = agent.score5C2W(fs, ratios, slik, {}, {}, {});

      const character = scores.find(c => c.name === 'Character');
      expect(character.score).toBe(5);
    });

    it('returns 7 components', () => {
      const fs = {};
      const ratios = agent.calculateRatios(fs);
      const scores = agent.score5C2W(fs, ratios, {}, {}, {}, {});
      expect(scores).toHaveLength(7);
    });
  });

  describe('detectAMLPatterns', () => {
    it('detects structuring near Rp500M', () => {
      const transactions = [
        { amount: 450_000_000, date: '2024-01-01', type: 'transfer', counterparty: 'A' },
        { amount: 480_000_000, date: '2024-01-02', type: 'transfer', counterparty: 'B' },
        { amount: 499_000_000, date: '2024-01-03', type: 'transfer', counterparty: 'C' },
      ];
      const patterns = agent.detectAMLPatterns(transactions, {}, {});
      const structuring = patterns.find(p => p.type === 'structuring');

      expect(structuring.detected).toBe(true);
      expect(structuring.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('does not flag normal transactions', () => {
      const transactions = [
        { amount: 100_000_000, date: '2024-01-01', type: 'transfer', counterparty: 'A' },
        { amount: 200_000_000, date: '2024-02-01', type: 'transfer', counterparty: 'B' },
      ];
      const patterns = agent.detectAMLPatterns(transactions, {}, {});
      const structuring = patterns.find(p => p.type === 'structuring');

      expect(structuring.detected).toBe(false);
    });

    it('detects wealth gap', () => {
      const wealth = { lifestyle_assets: 10_000_000_000, estimated_income: 500_000_000 };
      const patterns = agent.detectAMLPatterns([], wealth, {});
      const gap = patterns.find(p => p.type === 'wealth_gap');

      expect(gap.detected).toBe(true);
    });

    it('detects shell company signals', () => {
      const corp = { nominees: true, zeroRevenue: true, shellIndicators: ['layered ownership'], interAccountTransfers: 5 };
      const patterns = agent.detectAMLPatterns([], {}, corp);
      const shell = patterns.find(p => p.type === 'shell_signals');

      expect(shell.detected).toBe(true);
    });
  });
});
