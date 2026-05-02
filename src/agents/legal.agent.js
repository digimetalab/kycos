/**
 * @fileoverview Legal & Compliance Agent.
 * Checks court records, sanctions lists (OFAC/UN/EU), PEP status.
 */

import { BaseAgent } from '../core/base-agent.js';

export class LegalAgent extends BaseAgent {
  constructor() {
    super({
      name: 'legal',
      displayName: 'Legal & Compliance Agent',
      taskType: 'data_extraction',
      systemPrompt: 'You are KYCOS Legal & Compliance Agent — a specialist in legal due diligence and sanctions screening. Search court records (Indonesian PN/PTUN and international), check OFAC SDN list, UN/EU consolidated sanctions lists, and detect Politically Exposed Persons (PEP). Verify business registrations and licenses. Any sanctions match is a CRITICAL red flag. Return structured JSON.',
      tools: ['sanctions-api', 'court-search'],
    });
  }

  async execute(target, context) {
    const redFlags = [];
    const sources = [];

    const prompt = `Perform legal and compliance due diligence for:
Name: ${target.name}
Type: ${target.type || 'individual'}
Country: ${target.country || 'ID'}
ID Number: ${target.idNumber || 'N/A'}
Company: ${target.company || 'N/A'}

Check:
1. Court records — Indonesian (PN/PTUN) and international
2. OFAC SDN list match
3. UN Consolidated Sanctions list match
4. EU Sanctions list match
5. PEP (Politically Exposed Person) screening
6. Business registration and license verification
7. Bankruptcy filings
8. Regulatory enforcement actions

Return JSON:
{
  "courtCases": [{ "court": "string", "caseNumber": "string", "type": "civil|criminal|administrative", "status": "active|closed|appeal", "summary": "string", "date": "string" }],
  "sanctionsScreening": {
    "ofac": { "match": false, "details": "string", "matchScore": 0.0 },
    "un":   { "match": false, "details": "string", "matchScore": 0.0 },
    "eu":   { "match": false, "details": "string", "matchScore": 0.0 }
  },
  "pepStatus": { "isPEP": false, "level": "none|domestic|foreign", "position": "string", "relatedPEP": false },
  "registrations": [{ "type": "string", "number": "string", "status": "active|expired|revoked", "authority": "string" }],
  "bankruptcy": { "filed": false, "details": "string" },
  "enforcement": [{ "authority": "string", "action": "string", "date": "string", "status": "string" }],
  "overallLegalRisk": "low|medium|high|critical"
}`;

    const { data } = await this.aiJSON(prompt);
    sources.push('AI Legal Analysis');

    // CRITICAL — Sanctions matches
    const sanctions = data.sanctionsScreening || {};
    for (const [list, result] of Object.entries(sanctions)) {
      if (result.match) {
        redFlags.push({
          severity: 'critical',
          category: 'sanctions',
          description: `${list.toUpperCase()} sanctions match: ${result.details} (score: ${result.matchScore})`,
          source: `${list.toUpperCase()} Screening`,
          confidence: result.matchScore || 0.9,
        });
      }
    }

    // PEP detection
    if (data.pepStatus?.isPEP) {
      redFlags.push({
        severity: 'high',
        category: 'pep',
        description: `PEP detected — ${data.pepStatus.level}: ${data.pepStatus.position}`,
        source: 'PEP Screening',
        confidence: 0.85,
      });
    }
    if (data.pepStatus?.relatedPEP) {
      redFlags.push({
        severity: 'medium',
        category: 'pep',
        description: 'Related to a Politically Exposed Person',
        source: 'PEP Screening',
        confidence: 0.7,
      });
    }

    // Active criminal cases
    const criminalCases = (data.courtCases || []).filter(c => c.type === 'criminal' && c.status === 'active');
    if (criminalCases.length > 0) {
      redFlags.push({
        severity: 'critical',
        category: 'legal',
        description: `${criminalCases.length} active criminal case(s): ${criminalCases.map(c => c.summary).join('; ')}`,
        source: 'Court Records',
        confidence: 0.9,
      });
    }

    // Bankruptcy
    if (data.bankruptcy?.filed) {
      redFlags.push({
        severity: 'high',
        category: 'financial',
        description: `Bankruptcy filing: ${data.bankruptcy.details}`,
        source: 'Court Records',
        confidence: 0.9,
      });
    }

    // Confidence based on findings
    const hasSanctions = Object.values(sanctions).some(s => s.match);
    const confidence = hasSanctions ? 0.95 : data.courtCases?.length > 0 ? 0.8 : 0.7;

    return this.formatResult(data, { redFlags, sources, confidence });
  }
}
