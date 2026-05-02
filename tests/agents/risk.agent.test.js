/**
 * @fileoverview Tests for Risk Agent — Basel IRB model, Z-Score, Scorecard.
 * Tests core quantitative logic without AI dependency.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RiskAgent } from '../../src/agents/risk.agent.js';

vi.mock('../../src/core/ai-router.js', () => ({
  routeCompletion: vi.fn(),
  routeJSON: vi.fn(),
}));

describe('RiskAgent', () => {
  let agent;

  beforeEach(() => {
    agent = new RiskAgent();
  });

  describe('calculateAltmanZ', () => {
    it('computes Z-Score correctly', () => {
      const inputs = {
        workingCapital: 200,
        totalAssets: 1000,
        retainedEarnings: 300,
        ebit: 150,
        marketValueEquity: 500,
        totalLiabilities: 400,
        sales: 800,
      };

      const result = agent.calculateAltmanZ(inputs);

      // Z = 1.2×(200/1000) + 1.4×(300/1000) + 3.3×(150/1000) + 0.6×(500/400) + 1.0×(800/1000)
      // Z = 0.24 + 0.42 + 0.495 + 0.75 + 0.8 = 2.705
      expect(result.zScore).toBeCloseTo(2.705, 2);
      expect(result.zone).toBe('grey');
    });

    it('categorizes safe zone correctly', () => {
      const result = agent.calculateAltmanZ({
        workingCapital: 500, totalAssets: 1000, retainedEarnings: 500,
        ebit: 300, marketValueEquity: 2000, totalLiabilities: 400, sales: 1200,
      });

      expect(result.zone).toBe('safe');
      expect(result.zScore).toBeGreaterThan(2.99);
    });

    it('categorizes distress zone correctly', () => {
      const result = agent.calculateAltmanZ({
        workingCapital: -100, totalAssets: 1000, retainedEarnings: -200,
        ebit: -50, marketValueEquity: 100, totalLiabilities: 900, sales: 300,
      });

      expect(result.zone).toBe('distress');
      expect(result.zScore).toBeLessThan(1.81);
    });

    it('handles zero totalAssets safely', () => {
      const result = agent.calculateAltmanZ({ totalAssets: 0, totalLiabilities: 1 });
      expect(result).toBeDefined();
      expect(typeof result.zScore).toBe('number');
    });
  });

  describe('zScoreToPD', () => {
    it('maps safe zone to low PD', () => {
      expect(agent.zScoreToPD(4.0)).toBe(0.001);
      expect(agent.zScoreToPD(3.2)).toBe(0.01);
    });

    it('maps distress zone to high PD', () => {
      expect(agent.zScoreToPD(0.5)).toBe(0.50);
      expect(agent.zScoreToPD(1.5)).toBe(0.30);
    });

    it('maps grey zone appropriately', () => {
      const pd = agent.zScoreToPD(2.5);
      expect(pd).toBeGreaterThan(0.01);
      expect(pd).toBeLessThan(0.15);
    });
  });

  describe('buildScorecard', () => {
    it('builds a scorecard for good credit', () => {
      const inputs = {
        slikKolektibilitas: 1,
        onTimePaymentPct: 0.98,
        totalDebt: 200,
        totalCreditLimit: 1000,
        oldestAccountYears: 8,
        accountTypes: 4,
        recentInquiries: 1,
        sanctionsMatch: false,
      };

      const scorecard = agent.buildScorecard(inputs, { positiveIndicators: ['good reputation'], negativeIndicators: [], sentimentScore: 0.5 });

      expect(scorecard.totalScore).toBeGreaterThan(600);
      expect(scorecard.sanctionsMatch).toBe(false);
      expect(scorecard.decision).not.toBe('REJECT');
    });

    it('instant-rejects on sanctions match', () => {
      const inputs = { sanctionsMatch: true };
      const scorecard = agent.buildScorecard(inputs, {});

      expect(scorecard.totalScore).toBe(0);
      expect(scorecard.rating).toBe('D');
      expect(scorecard.kolektibilitas).toBe(5);
      expect(scorecard.decision).toBe('REJECT');
    });

    it('scores bad credit low', () => {
      const inputs = {
        slikKolektibilitas: 5,
        onTimePaymentPct: 0.2,
        totalDebt: 900,
        totalCreditLimit: 1000,
        oldestAccountYears: 1,
        accountTypes: 1,
        recentInquiries: 8,
        sanctionsMatch: false,
      };

      const scorecard = agent.buildScorecard(inputs, { positiveIndicators: [], negativeIndicators: ['fraud', 'bankruptcy'], sentimentScore: -0.8 });

      expect(scorecard.totalScore).toBeLessThan(400);
      expect(scorecard.decision).toBe('REJECT');
    });

    it('clamps total score to 0-850', () => {
      const inputs = {
        slikKolektibilitas: 1, onTimePaymentPct: 1.0,
        totalDebt: 0, totalCreditLimit: 10000,
        oldestAccountYears: 20, accountTypes: 10,
        recentInquiries: 0, sanctionsMatch: false,
      };
      const scorecard = agent.buildScorecard(inputs, { positiveIndicators: Array(10).fill('x'), negativeIndicators: [], sentimentScore: 1.0 });

      expect(scorecard.totalScore).toBeLessThanOrEqual(850);
      expect(scorecard.totalScore).toBeGreaterThanOrEqual(0);
    });
  });
});
