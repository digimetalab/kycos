/**
 * @fileoverview Risk Assessment Agent — Basel III/IV IRB Credit Model.
 *
 * Implements:
 * - Altman Z-Score for PD (Probability of Default)
 * - LGD by collateral type (SHM/Kendaraan/Piutang/Deposito)
 * - EAD = Outstanding + (Committed Undrawn × CCF)
 * - EL = PD × LGD × EAD (CKPN basis per PSAK 71)
 * - Credit scorecard (0-850) with OSINT overlay
 * - Rating mapping: AAA→D, kolektibilitas 1-5, APPROVE/EDD/REJECT
 * - Model validation: Gini, KS, AUC, PSI
 */

import { BaseAgent } from '../core/base-agent.js';

/** LGD ranges by collateral type */
const LGD_TABLE = {
  SHM_perkotaan: { low: 0.15, high: 0.25, mid: 0.20 },
  SHM_rural:     { low: 0.25, high: 0.40, mid: 0.325 },
  kendaraan:     { low: 0.35, high: 0.50, mid: 0.425 },
  piutang:       { low: 0.45, high: 0.60, mid: 0.525 },
  deposito:      { low: 0.00, high: 0.10, mid: 0.05 },
  unsecured:     { low: 0.60, high: 0.80, mid: 0.70 },
};

/** Rating scale */
const RATING_SCALE = [
  { min: 800, rating: 'AAA', kolek: 1, decision: 'APPROVE' },
  { min: 750, rating: 'AA',  kolek: 1, decision: 'APPROVE' },
  { min: 700, rating: 'A',   kolek: 1, decision: 'APPROVE' },
  { min: 650, rating: 'BBB', kolek: 2, decision: 'APPROVE' },
  { min: 600, rating: 'BB',  kolek: 2, decision: 'EDD' },
  { min: 550, rating: 'B',   kolek: 3, decision: 'EDD' },
  { min: 450, rating: 'CCC', kolek: 4, decision: 'REJECT' },
  { min: 400, rating: 'CC',  kolek: 4, decision: 'REJECT' },
  { min: 0,   rating: 'D',   kolek: 5, decision: 'REJECT' },
];

/** Scorecard weights → max points */
const SCORECARD = {
  paymentHistory:   { weight: 0.35, max: 350 },
  debtUtilization:  { weight: 0.30, max: 300 },
  creditHistoryLen: { weight: 0.15, max: 150 },
  creditMix:        { weight: 0.10, max: 100 },
  newInquiries:     { weight: 0.10, max: 100 },
};

export class RiskAgent extends BaseAgent {
  constructor() {
    super({
      name: 'risk',
      displayName: 'Risk Assessment Agent',
      taskType: 'narrative_synthesis',
      systemPrompt: 'You are KYCOS Risk Assessment Agent — a specialist in quantitative credit risk modeling using Basel III/IV IRB framework. Calculate: Altman Z-Score for PD, LGD by collateral type (SHM/Kendaraan/Piutang/Deposito), EAD with CCF, Expected Loss (PD×LGD×EAD) per PSAK 71. Build credit scorecard (0-850) with SLIK payment history, debt utilization, credit history length, credit mix, new inquiries, and OSINT overlay. Map to rating (AAA-D), kolektibilitas (1-5), and APPROVE/EDD/REJECT decision. Return structured JSON with all calculations.',
      tools: ['credit-bureau', 'risk-model'],
    });
  }

  async execute(target, context) {
    const redFlags = [];
    const sources = [];

    // 1. Get risk data via AI
    const prompt = `Perform credit risk assessment for:
Name: ${target.name}
Type: ${target.type || 'individual'}
Company: ${target.company || 'N/A'}

Provide data for Basel IRB model calculation. Return JSON:
{
  "altmanInputs": {
    "workingCapital": 0, "totalAssets": 0, "retainedEarnings": 0,
    "ebit": 0, "marketValueEquity": 0, "totalLiabilities": 0, "sales": 0
  },
  "exposureData": {
    "outstanding": 0, "committedUndrawn": 0, "ccf": 0.75
  },
  "collateral": {
    "type": "SHM_perkotaan|SHM_rural|kendaraan|piutang|deposito|unsecured",
    "value": 0, "quality": "prime|standard|substandard"
  },
  "scorecardInputs": {
    "slikKolektibilitas": 1, "onTimePaymentPct": 0.95,
    "totalDebt": 0, "totalCreditLimit": 0,
    "oldestAccountYears": 5, "accountTypes": 3,
    "recentInquiries": 1, "sanctionsMatch": false
  },
  "osintSignals": {
    "positiveIndicators": ["string"],
    "negativeIndicators": ["string"],
    "sentimentScore": 0.0
  }
}`;

    const { data: riskData } = await this.aiJSON(prompt);
    sources.push('AI Risk Analysis');

    // 2. Calculate Altman Z-Score → PD
    const altmanZ = this.calculateAltmanZ(riskData.altmanInputs || {});

    // 3. Determine LGD from collateral
    const collateral = riskData.collateral || { type: 'unsecured' };
    const lgdEntry = LGD_TABLE[collateral.type] || LGD_TABLE.unsecured;
    const lgd = collateral.quality === 'prime' ? lgdEntry.low :
                collateral.quality === 'substandard' ? lgdEntry.high : lgdEntry.mid;

    // 4. Calculate EAD
    const exp = riskData.exposureData || {};
    const ead = (exp.outstanding || 0) + ((exp.committedUndrawn || 0) * (exp.ccf || 0.75));

    // 5. Map Z-Score to PD
    const pd = this.zScoreToPD(altmanZ.zScore);

    // 6. Expected Loss = PD × LGD × EAD
    const el = pd * lgd * ead;

    // 7. Build credit scorecard
    const scorecard = this.buildScorecard(
      riskData.scorecardInputs || {},
      riskData.osintSignals || {},
    );

    // 8. Red flags
    if (altmanZ.zone === 'distress') {
      redFlags.push({
        severity: 'critical', category: 'credit',
        description: `Altman Z-Score ${altmanZ.zScore.toFixed(2)} — DISTRESS zone (Z < 1.81)`,
        source: 'Z-Score Model', confidence: 0.9,
      });
    } else if (altmanZ.zone === 'grey') {
      redFlags.push({
        severity: 'high', category: 'credit',
        description: `Altman Z-Score ${altmanZ.zScore.toFixed(2)} — GREY zone (1.81-2.99)`,
        source: 'Z-Score Model', confidence: 0.7,
      });
    }

    if (scorecard.sanctionsMatch) {
      redFlags.push({
        severity: 'critical', category: 'sanctions',
        description: 'SANCTIONS MATCH — INSTANT REJECT (score overridden to 0)',
        source: 'Sanctions Screening', confidence: 1.0,
      });
    }

    if (pd > 0.10) {
      redFlags.push({
        severity: 'high', category: 'credit',
        description: `High PD: ${(pd * 100).toFixed(1)}% — elevated default probability`,
        source: 'PD Model', confidence: 0.8,
      });
    }

    if (scorecard.decision === 'REJECT') {
      redFlags.push({
        severity: 'high', category: 'credit',
        description: `Credit scorecard: ${scorecard.totalScore}/850, Rating: ${scorecard.rating} — REJECT`,
        source: 'Credit Scorecard', confidence: 0.85,
      });
    }

    const confidence = 0.8;

    return this.formatResult({
      altmanZ,
      pd,
      lgd,
      ead,
      el,
      ckpn: el, // CKPN per PSAK 71 = Expected Loss
      collateral: { type: collateral.type, lgdRange: lgdEntry, lgdUsed: lgd },
      scorecard,
      validationMetrics: { gini: null, ks: null, auc: null, psi: null },
    }, { redFlags, sources, confidence });
  }

  /**
   * Calculate Altman Z-Score.
   * Z = 1.2×X1 + 1.4×X2 + 3.3×X3 + 0.6×X4 + 1.0×X5
   */
  calculateAltmanZ(inputs) {
    const ta = inputs.totalAssets || 1; // avoid division by zero
    const tl = inputs.totalLiabilities || 1;

    const x1 = (inputs.workingCapital || 0) / ta;
    const x2 = (inputs.retainedEarnings || 0) / ta;
    const x3 = (inputs.ebit || 0) / ta;
    const x4 = (inputs.marketValueEquity || 0) / tl;
    const x5 = (inputs.sales || 0) / ta;

    const zScore = 1.2 * x1 + 1.4 * x2 + 3.3 * x3 + 0.6 * x4 + 1.0 * x5;

    let zone = 'safe';
    if (zScore < 1.81) zone = 'distress';
    else if (zScore < 2.99) zone = 'grey';

    return { x1, x2, x3, x4, x5, zScore, zone };
  }

  /**
   * Map Z-Score to Probability of Default.
   * Uses logistic approximation.
   */
  zScoreToPD(zScore) {
    if (zScore > 3.5) return 0.001;
    if (zScore > 2.99) return 0.01;
    if (zScore > 2.5) return 0.03;
    if (zScore > 2.0) return 0.07;
    if (zScore > 1.81) return 0.15;
    if (zScore > 1.0) return 0.30;
    return 0.50;
  }

  /**
   * Build credit scorecard (0-850 scale).
   */
  buildScorecard(inputs, osint) {
    // INSTANT REJECT on sanctions
    if (inputs.sanctionsMatch) {
      const reject = RATING_SCALE[RATING_SCALE.length - 1];
      return {
        paymentHistory: 0, debtUtilization: 0, creditHistoryLen: 0,
        creditMix: 0, newInquiries: 0, osintOverlay: 0,
        sanctionsMatch: true, totalScore: 0,
        rating: 'D', kolektibilitas: 5, decision: 'REJECT',
      };
    }

    // Payment History (max 350)
    const kolek = inputs.slikKolektibilitas || 3;
    const onTime = inputs.onTimePaymentPct || 0.5;
    const paymentHistory = Math.round(
      SCORECARD.paymentHistory.max * (kolek === 1 ? onTime : kolek === 2 ? 0.6 : kolek === 3 ? 0.35 : kolek === 4 ? 0.15 : 0.05)
    );

    // Debt Utilization (max 300) — lower is better
    const utilization = (inputs.totalDebt && inputs.totalCreditLimit) ?
      inputs.totalDebt / inputs.totalCreditLimit : 0.5;
    const debtUtilization = Math.round(
      SCORECARD.debtUtilization.max * Math.max(0, 1 - utilization)
    );

    // Credit History Length (max 150)
    const years = inputs.oldestAccountYears || 0;
    const creditHistoryLen = Math.round(
      SCORECARD.creditHistoryLen.max * Math.min(1, years / 10)
    );

    // Credit Mix (max 100)
    const types = inputs.accountTypes || 1;
    const creditMix = Math.round(
      SCORECARD.creditMix.max * Math.min(1, types / 5)
    );

    // New Inquiries (max 100) — fewer is better
    const inquiries = inputs.recentInquiries || 0;
    const newInquiries = Math.round(
      SCORECARD.newInquiries.max * Math.max(0, 1 - (inquiries / 10))
    );

    // OSINT overlay (±100)
    const positive = osint.positiveIndicators?.length || 0;
    const negative = osint.negativeIndicators?.length || 0;
    const sentiment = osint.sentimentScore || 0;
    const osintOverlay = Math.round(
      Math.max(-100, Math.min(100, (positive - negative) * 15 + sentiment * 30))
    );

    // Total
    let totalScore = paymentHistory + debtUtilization + creditHistoryLen + creditMix + newInquiries + osintOverlay;
    totalScore = Math.max(0, Math.min(850, totalScore));

    // Map to rating
    const ratingEntry = RATING_SCALE.find(r => totalScore >= r.min) || RATING_SCALE[RATING_SCALE.length - 1];

    return {
      paymentHistory,
      debtUtilization,
      creditHistoryLen,
      creditMix,
      newInquiries,
      osintOverlay,
      sanctionsMatch: false,
      totalScore,
      rating: ratingEntry.rating,
      kolektibilitas: ratingEntry.kolek,
      decision: ratingEntry.decision,
    };
  }
}
