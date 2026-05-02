/**
 * @fileoverview Financial Intelligence Agent — 5C+2W Analysis + AML Detection.
 * Implements the complete 5C+2W credit assessment framework with
 * financial ratio calculations and AML pattern detection.
 *
 * 5C+2W Weights:
 *   Character:   20% → SLIK kolektibilitas + OSINT sentiment
 *   Capacity:    25% → DSCR = EBIT/(Principal+Interest), must be > 1.2x
 *   Capital:     20% → DER < 3x, Equity Ratio > 25%
 *   Collateral:  15% → LTV < 80%, haircut by collateral type
 *   Condition:   10% → industry risk score from LLM web search
 *   Willingness:  5% → payment behavior consistency index
 *   Wealth:       5% → LHKPN delta + wealth-income consistency
 */

import { BaseAgent } from '../core/base-agent.js';

/** 5C+2W component weights */
const WEIGHTS = {
  character:   0.20,
  capacity:    0.25,
  capital:     0.20,
  collateral:  0.15,
  condition:   0.10,
  willingness: 0.05,
  wealth:      0.05,
};

/** AML structuring threshold (Rp500M) */
const AML_STRUCTURING_THRESHOLD = 500_000_000;

export class FinancialAgent extends BaseAgent {
  constructor() {
    super({
      name: 'financial',
      displayName: 'Financial Intelligence Agent',
      taskType: 'narrative_synthesis',
      systemPrompt: 'You are KYCOS Financial Intelligence Agent — a specialist in financial analysis using the 5C+2W credit assessment framework (Character, Capacity, Capital, Collateral, Condition, Willingness, Wealth). Calculate financial ratios (liquidity, profitability, solvability, activity), detect AML patterns (structuring, layering, wealth gaps, shell companies), and produce a composite credit score. Use Indonesian banking standards (SLIK, LHKPN, Rp500M threshold). Return structured JSON with all calculations shown.',
      tools: ['financial-data', 'aml-scanner'],
    });
  }

  async execute(target, context) {
    const redFlags = [];
    const sources = [];

    // 1. Get financial data via AI analysis
    const prompt = `Perform comprehensive financial analysis for KYC/AML on:
Name: ${target.name}
Type: ${target.type || 'individual'}
Country: ${target.country || 'ID'}
Company: ${target.company || 'N/A'}

Analyze using the 5C+2W framework and return ALL of the following in JSON:
{
  "financialStatements": {
    "currentAssets": 0, "totalAssets": 0, "currentLiabilities": 0, "totalLiabilities": 0,
    "equity": 0, "revenue": 0, "ebit": 0, "ebitda": 0, "netIncome": 0,
    "retainedEarnings": 0, "workingCapital": 0, "operatingCashFlow": 0, "cash": 0,
    "receivables": 0, "inventory": 0, "marketValueEquity": 0, "sales": 0,
    "interestExpense": 0, "principalPayments": 0, "totalDebt": 0,
    "costOfGoodsSold": 0, "depreciation": 0
  },
  "slikData": {
    "kolektibilitas": 1, "paymentHistory": "good|fair|poor",
    "outstandingLoans": 0, "consistencyIndex": 0.0
  },
  "collateralData": {
    "type": "SHM_perkotaan|SHM_rural|kendaraan|piutang|deposito",
    "appraised_value": 0, "loan_amount": 0
  },
  "industryData": { "sector": "string", "riskLevel": "low|medium|high", "outlook": "string" },
  "wealthData": {
    "lhkpn_declared": 0, "lhkpn_previous": 0, "estimated_income": 0,
    "lifestyle_assets": 0
  },
  "transactionPatterns": [
    { "amount": 0, "date": "string", "type": "string", "counterparty": "string" }
  ],
  "corporateStructure": {
    "nominees": false, "zeroRevenue": false, "shellIndicators": [],
    "interAccountTransfers": 0
  }
}

Use realistic estimates if exact data unavailable. Flag assumptions.`;

    const { data: financialData } = await this.aiJSON(prompt);
    sources.push('AI Financial Analysis');

    const fs = financialData.financialStatements || {};
    const slik = financialData.slikData || {};
    const collateral = financialData.collateralData || {};
    const industry = financialData.industryData || {};
    const wealth = financialData.wealthData || {};
    const transactions = financialData.transactionPatterns || [];
    const corp = financialData.corporateStructure || {};

    // 2. Calculate financial ratios
    const ratios = this.calculateRatios(fs);

    // 3. Score 5C+2W components
    const fiveCScores = this.score5C2W(fs, ratios, slik, collateral, industry, wealth);

    // 4. AML pattern detection
    const amlPatterns = this.detectAMLPatterns(transactions, wealth, corp);

    // 5. Collect red flags
    // --- Ratio-based flags ---
    if (ratios.solvability.dscr !== null && ratios.solvability.dscr < 1.2) {
      redFlags.push({
        severity: 'high', category: 'financial',
        description: `DSCR ${ratios.solvability.dscr?.toFixed(2)} below 1.2x threshold — insufficient debt service capacity`,
        source: 'Financial Ratios', confidence: 0.85,
      });
    }
    if (ratios.solvability.der !== null && ratios.solvability.der > 3) {
      redFlags.push({
        severity: 'high', category: 'financial',
        description: `DER ${ratios.solvability.der?.toFixed(2)} exceeds 3x limit — over-leveraged`,
        source: 'Financial Ratios', confidence: 0.85,
      });
    }
    if (ratios.profitability.interestCoverage !== null && ratios.profitability.interestCoverage < 2) {
      redFlags.push({
        severity: 'medium', category: 'financial',
        description: `Interest Coverage Ratio ${ratios.profitability.interestCoverage?.toFixed(2)} below 2x — tight interest coverage`,
        source: 'Financial Ratios', confidence: 0.8,
      });
    }

    // --- AML flags ---
    for (const pattern of amlPatterns) {
      if (pattern.detected) {
        redFlags.push({
          severity: pattern.type === 'structuring' ? 'critical' : 'high',
          category: 'aml',
          description: pattern.details,
          source: 'AML Scanner',
          confidence: pattern.confidence,
        });
      }
    }

    // --- SLIK flags ---
    if (slik.kolektibilitas >= 3) {
      redFlags.push({
        severity: 'high', category: 'financial',
        description: `SLIK kolektibilitas ${slik.kolektibilitas} — non-performing loan status`,
        source: 'SLIK Data', confidence: 0.9,
      });
    }

    // Composite score (0-100 weighted average)
    const compositeScore = fiveCScores.reduce((sum, c) => sum + c.weighted, 0);

    const confidence = fiveCScores.every(c => c.score > 0) ? 0.75 : 0.5;

    return this.formatResult({
      fiveCScores,
      compositeScore,
      ratios,
      amlPatterns,
      slikData: slik,
      recommendation: compositeScore >= 70 ? 'FAVORABLE' : compositeScore >= 50 ? 'CONDITIONAL' : 'UNFAVORABLE',
    }, { redFlags, sources, confidence });
  }

  /**
   * Calculate all financial ratios from statements.
   * @param {Object} fs - Financial statements
   * @returns {Object} Categorized ratios
   */
  calculateRatios(fs) {
    const safe = (n, d) => (d && d !== 0) ? n / d : null;

    return {
      liquidity: {
        currentRatio:     safe(fs.currentAssets, fs.currentLiabilities),
        quickRatio:       safe((fs.currentAssets || 0) - (fs.inventory || 0), fs.currentLiabilities),
        cashRatio:        safe(fs.cash, fs.currentLiabilities),
        operatingCFRatio: safe(fs.operatingCashFlow, fs.currentLiabilities),
      },
      profitability: {
        roa:              safe(fs.netIncome, fs.totalAssets),
        roe:              safe(fs.netIncome, fs.equity),
        netMargin:        safe(fs.netIncome, fs.revenue),
        ebitdaMargin:     safe(fs.ebitda, fs.revenue),
        interestCoverage: safe(fs.ebit, fs.interestExpense),
      },
      solvability: {
        der:            safe(fs.totalDebt || fs.totalLiabilities, fs.equity),
        dar:            safe(fs.totalLiabilities, fs.totalAssets),
        debtToEBITDA:   safe(fs.totalDebt || fs.totalLiabilities, fs.ebitda),
        dscr:           safe(fs.ebit, (fs.principalPayments || 0) + (fs.interestExpense || 0)),
      },
      activity: {
        receivablesTurnover: safe(fs.revenue || fs.sales, fs.receivables),
        inventoryTurnover:   safe(fs.costOfGoodsSold, fs.inventory),
        assetTurnover:       safe(fs.revenue || fs.sales, fs.totalAssets),
      },
    };
  }

  /**
   * Score each 5C+2W component (0-100 scale), then apply weights.
   */
  score5C2W(fs, ratios, slik, collateral, industry, wealth) {
    const components = [];

    // Character (20%) — SLIK + sentiment
    const charScore = slik.kolektibilitas === 1 ? 90 : slik.kolektibilitas === 2 ? 65 :
                      slik.kolektibilitas === 3 ? 40 : slik.kolektibilitas === 4 ? 20 : 5;
    components.push(this.makeComponent('Character', WEIGHTS.character, charScore,
      `SLIK kolektibilitas: ${slik.kolektibilitas || 'N/A'}`));

    // Capacity (25%) — DSCR
    const dscr = ratios.solvability.dscr;
    const capScore = dscr === null ? 50 : dscr >= 2.0 ? 95 : dscr >= 1.5 ? 80 :
                     dscr >= 1.2 ? 65 : dscr >= 1.0 ? 40 : 15;
    components.push(this.makeComponent('Capacity', WEIGHTS.capacity, capScore,
      `DSCR: ${dscr?.toFixed(2) || 'N/A'}`));

    // Capital (20%) — DER + Equity Ratio
    const der = ratios.solvability.der;
    const eqRatio = fs.equity && fs.totalAssets ? fs.equity / fs.totalAssets : null;
    const capitalScore = der === null ? 50 :
      (der <= 1 ? 90 : der <= 2 ? 75 : der <= 3 ? 55 : 25) +
      (eqRatio !== null && eqRatio >= 0.25 ? 10 : 0);
    components.push(this.makeComponent('Capital', WEIGHTS.capital, Math.min(100, capitalScore),
      `DER: ${der?.toFixed(2) || 'N/A'}, Equity Ratio: ${eqRatio ? (eqRatio * 100).toFixed(1) + '%' : 'N/A'}`));

    // Collateral (15%) — LTV
    const ltv = collateral.loan_amount && collateral.appraised_value ?
      collateral.loan_amount / collateral.appraised_value : null;
    const collScore = ltv === null ? 50 : ltv <= 0.5 ? 95 : ltv <= 0.65 ? 80 :
                      ltv <= 0.8 ? 65 : ltv <= 0.9 ? 40 : 15;
    components.push(this.makeComponent('Collateral', WEIGHTS.collateral, collScore,
      `LTV: ${ltv ? (ltv * 100).toFixed(1) + '%' : 'N/A'}, Type: ${collateral.type || 'N/A'}`));

    // Condition (10%) — Industry risk
    const condScore = industry.riskLevel === 'low' ? 85 : industry.riskLevel === 'medium' ? 60 : 30;
    components.push(this.makeComponent('Condition', WEIGHTS.condition, condScore,
      `Industry: ${industry.sector || 'N/A'}, Risk: ${industry.riskLevel || 'N/A'}`));

    // Willingness (5%) — Payment consistency
    const willScore = slik.consistencyIndex ? Math.round(slik.consistencyIndex * 100) : 50;
    components.push(this.makeComponent('Willingness', WEIGHTS.willingness, willScore,
      `Consistency Index: ${slik.consistencyIndex?.toFixed(2) || 'N/A'}`));

    // Wealth (5%) — LHKPN + income consistency
    const lhkpnDelta = wealth.lhkpn_declared && wealth.lhkpn_previous ?
      (wealth.lhkpn_declared - wealth.lhkpn_previous) / wealth.lhkpn_previous : null;
    const wealthGap = wealth.lifestyle_assets && wealth.estimated_income ?
      wealth.lifestyle_assets / (wealth.estimated_income * 5) : null;
    const wealthScore = wealthGap === null ? 50 : wealthGap <= 1 ? 85 :
                        wealthGap <= 2 ? 65 : wealthGap <= 3 ? 40 : 15;
    components.push(this.makeComponent('Wealth', WEIGHTS.wealth, wealthScore,
      `LHKPN delta: ${lhkpnDelta ? (lhkpnDelta * 100).toFixed(1) + '%' : 'N/A'}, Wealth gap ratio: ${wealthGap?.toFixed(2) || 'N/A'}`));

    return components;
  }

  /** Helper to create a scored component */
  makeComponent(name, weight, score, details) {
    return { name, weight, score: Math.min(100, Math.max(0, score)), weighted: Math.round(weight * score * 100) / 100, details };
  }

  /**
   * Detect AML patterns in transaction and corporate data.
   */
  detectAMLPatterns(transactions, wealth, corp) {
    const patterns = [];

    // 1. Structuring — clustering below Rp500M
    const nearThreshold = transactions.filter(t =>
      t.amount >= AML_STRUCTURING_THRESHOLD * 0.8 && t.amount < AML_STRUCTURING_THRESHOLD
    );
    patterns.push({
      type: 'structuring',
      detected: nearThreshold.length >= 3,
      confidence: nearThreshold.length >= 5 ? 0.9 : nearThreshold.length >= 3 ? 0.7 : 0.2,
      details: nearThreshold.length >= 3
        ? `${nearThreshold.length} transactions clustering just below Rp500M threshold (structuring pattern)`
        : 'No structuring pattern detected',
      evidence: nearThreshold.map(t => `Rp${t.amount?.toLocaleString()} on ${t.date}`),
    });

    // 2. Layering — rapid inter-account transfers
    patterns.push({
      type: 'layering',
      detected: (corp.interAccountTransfers || 0) > 10,
      confidence: (corp.interAccountTransfers || 0) > 20 ? 0.8 : 0.5,
      details: (corp.interAccountTransfers || 0) > 10
        ? `${corp.interAccountTransfers} rapid inter-account transfers detected (layering indicator)`
        : 'No layering pattern detected',
      evidence: [],
    });

    // 3. Wealth Gap — lifestyle vs income
    const gap = wealth.lifestyle_assets && wealth.estimated_income ?
      wealth.lifestyle_assets / (wealth.estimated_income * 3) : 0;
    patterns.push({
      type: 'wealth_gap',
      detected: gap > 2,
      confidence: gap > 3 ? 0.85 : gap > 2 ? 0.65 : 0.1,
      details: gap > 2
        ? `Wealth gap ratio ${gap.toFixed(2)}x — lifestyle assets inconsistent with declared income`
        : 'No wealth gap detected',
      evidence: [],
    });

    // 4. Shell signals — nominees + zero revenue
    const shellSignals = [
      ...(corp.nominees ? ['Nominee ownership detected'] : []),
      ...(corp.zeroRevenue ? ['Zero-revenue entity'] : []),
      ...(corp.shellIndicators || []),
    ];
    patterns.push({
      type: 'shell_signals',
      detected: shellSignals.length >= 2,
      confidence: shellSignals.length >= 3 ? 0.8 : shellSignals.length >= 2 ? 0.6 : 0.1,
      details: shellSignals.length >= 2
        ? `Shell company signals: ${shellSignals.join(', ')}`
        : 'No shell company signals detected',
      evidence: shellSignals,
    });

    return patterns;
  }
}
