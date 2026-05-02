/**
 * @fileoverview KYCOS Schemas — Zod schemas for all data structures.
 * Provides runtime validation for AgentResult, RedFlag, InvestigationPlan,
 * and all agent-specific output schemas.
 */

import { z } from 'zod';

// ─── Core Schemas ──────────────────────────────────────────────

/** Red flag severity levels */
export const SeverityEnum = z.enum(['critical', 'high', 'medium', 'low']);

/** Red flag finding from any agent */
export const RedFlagSchema = z.object({
  severity:    SeverityEnum,
  category:    z.string().describe('e.g. "sanctions", "aml", "fraud", "pep"'),
  description: z.string(),
  source:      z.string().optional(),
  confidence:  z.number().min(0).max(1),
});

/** Standardized result from every agent */
export const AgentResultSchema = z.object({
  agent:       z.string(),
  status:      z.enum(['success', 'partial', 'failed']),
  confidence:  z.number().min(0).max(1),
  data:        z.record(z.any()),
  redFlags:    z.array(RedFlagSchema).default([]),
  sources:     z.array(z.string()).default([]),
  executionMs: z.number(),
});

/** Investigation target input */
export const TargetSchema = z.object({
  name:        z.string().min(1),
  type:        z.enum(['individual', 'corporation']).default('individual'),
  country:     z.string().default('ID'),
  idNumber:    z.string().optional(),
  company:     z.string().optional(),
  email:       z.string().email().optional(),
  phone:       z.string().optional(),
  additionalContext: z.string().optional(),
});

/** Investigation mode */
export const ModeEnum = z.enum(['quick', 'standard', 'deep', 'full-aml', 'credit']);

/** LLM-generated investigation plan */
export const InvestigationPlanSchema = z.object({
  id:          z.string().uuid(),
  target:      TargetSchema,
  mode:        ModeEnum,
  agents:      z.array(z.string()),
  priority:    z.record(z.number()).optional(),
  specialInstructions: z.record(z.string()).optional(),
  createdAt:   z.string().datetime(),
});

/** Aggregated investigation report */
export const InvestigationReportSchema = z.object({
  id:              z.string().uuid(),
  planId:          z.string().uuid(),
  target:          TargetSchema,
  mode:            ModeEnum,
  results:         z.array(AgentResultSchema),
  overallRisk:     z.enum(['low', 'medium', 'high', 'critical']),
  overallScore:    z.number().min(0).max(850),
  decision:        z.enum(['APPROVE', 'EDD', 'REJECT']),
  totalRedFlags:   z.number(),
  executionMs:     z.number(),
  completedAt:     z.string().datetime(),
});

// ─── Financial Agent Schemas ───────────────────────────────────

/** 5C+2W component score */
export const FiveCComponentSchema = z.object({
  name:    z.string(),
  weight:  z.number(),
  score:   z.number().min(0).max(100),
  weighted: z.number(),
  details: z.string(),
});

/** Financial ratios output */
export const FinancialRatiosSchema = z.object({
  liquidity: z.object({
    currentRatio:     z.number().optional(),
    quickRatio:       z.number().optional(),
    cashRatio:        z.number().optional(),
    operatingCFRatio: z.number().optional(),
  }),
  profitability: z.object({
    roa:              z.number().optional(),
    roe:              z.number().optional(),
    netMargin:        z.number().optional(),
    ebitdaMargin:     z.number().optional(),
    interestCoverage: z.number().optional(),
  }),
  solvability: z.object({
    der:            z.number().optional(),
    dar:            z.number().optional(),
    debtToEBITDA:   z.number().optional(),
    dscr:           z.number().optional(),
  }),
  activity: z.object({
    receivablesTurnover: z.number().optional(),
    inventoryTurnover:   z.number().optional(),
    assetTurnover:       z.number().optional(),
  }),
});

/** AML pattern detection result */
export const AMLPatternSchema = z.object({
  type:        z.enum(['structuring', 'layering', 'wealth_gap', 'shell_signals']),
  detected:    z.boolean(),
  confidence:  z.number().min(0).max(1),
  details:     z.string(),
  evidence:    z.array(z.string()).default([]),
});

// ─── Risk Agent Schemas ────────────────────────────────────────

/** Altman Z-Score breakdown */
export const AltmanZScoreSchema = z.object({
  x1: z.number().describe('Working Capital / Total Assets'),
  x2: z.number().describe('Retained Earnings / Total Assets'),
  x3: z.number().describe('EBIT / Total Assets'),
  x4: z.number().describe('Market Value Equity / Total Liabilities'),
  x5: z.number().describe('Sales / Total Assets'),
  zScore: z.number(),
  zone: z.enum(['safe', 'grey', 'distress']),
});

/** LGD by collateral type */
export const CollateralLGDSchema = z.object({
  type:    z.string(),
  lgdLow:  z.number(),
  lgdHigh: z.number(),
  lgdUsed: z.number(),
  haircut: z.number(),
});

/** Credit scorecard output */
export const ScorecardSchema = z.object({
  paymentHistory:    z.number().max(350),
  debtUtilization:   z.number().max(300),
  creditHistoryLen:  z.number().max(150),
  creditMix:         z.number().max(100),
  newInquiries:      z.number().max(100),
  osintOverlay:      z.number().min(-100).max(100),
  sanctionsMatch:    z.boolean(),
  totalScore:        z.number().min(0).max(850),
  rating:            z.string(),
  kolektibilitas:    z.number().min(1).max(5),
  decision:          z.enum(['APPROVE', 'EDD', 'REJECT']),
});

/** Basel IRB model output */
export const BaselIRBSchema = z.object({
  altmanZ:     AltmanZScoreSchema,
  pd:          z.number().describe('Probability of Default'),
  lgd:         z.number().describe('Loss Given Default'),
  ead:         z.number().describe('Exposure at Default'),
  el:          z.number().describe('Expected Loss = PD × LGD × EAD'),
  collateral:  z.array(CollateralLGDSchema),
  scorecard:   ScorecardSchema,
  validationMetrics: z.object({
    gini: z.number().optional(),
    ks:   z.number().optional(),
    auc:  z.number().optional(),
    psi:  z.number().optional(),
  }).optional(),
});

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Validate data against a Zod schema, returning { success, data, errors }.
 * @param {z.ZodSchema} schema
 * @param {any} data
 * @returns {{ success: boolean, data?: any, errors?: string[] }}
 */
export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
  };
}
