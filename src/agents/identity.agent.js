/**
 * @fileoverview Identity Verification Agent.
 * Resolves full names, aliases, ID numbers, and performs photo OSINT.
 */

import { BaseAgent } from '../core/base-agent.js';

export class IdentityAgent extends BaseAgent {
  constructor() {
    super({
      name: 'identity',
      displayName: 'Identity Verification Agent',
      taskType: 'data_extraction',
      systemPrompt: 'You are KYCOS Identity Agent — a specialist in identity verification and OSINT. Your task is to verify the identity of investigation targets by cross-referencing names, aliases, ID numbers (KTP/Passport/NPWP), and performing photo OSINT. Return structured JSON with verification status, confidence scores, and any red flags. Be thorough but factual — never fabricate information.',
      tools: ['google-search', 'id-validator'],
    });
  }

  async execute(target, context) {
    const startMs = performance.now();
    const redFlags = [];
    const sources = [];

    // 1. AI-powered identity analysis
    const prompt = `Analyze this identity for KYC verification:
Name: ${target.name}
Type: ${target.type || 'individual'}
Country: ${target.country || 'ID'}
ID Number: ${target.idNumber || 'Not provided'}
Company: ${target.company || 'Not provided'}
Email: ${target.email || 'Not provided'}

Perform:
1. Name verification — check for common aliases and transliterations
2. ID number validation (KTP format: 16 digits, NPWP format: 15 digits)
3. Cross-reference check — any known name matches in public records
4. Photo OSINT indicators — reverse image search signals

Return JSON:
{
  "fullName": "string",
  "aliases": ["string"],
  "idValidation": { "format": "valid|invalid", "type": "KTP|NPWP|Passport", "details": "string" },
  "nameMatches": [{ "source": "string", "match": "string", "confidence": 0.0 }],
  "photoOsint": { "available": false, "reverseSearchResults": [] },
  "verificationStatus": "verified|unverified|suspicious",
  "riskIndicators": ["string"]
}`;

    const { data } = await this.aiJSON(prompt);
    sources.push('AI Analysis');

    // 2. Flag suspicious findings
    if (data.verificationStatus === 'suspicious') {
      redFlags.push({
        severity: 'high',
        category: 'identity',
        description: `Identity verification flagged as suspicious: ${data.riskIndicators?.join(', ') || 'unknown reason'}`,
        source: 'Identity Agent',
        confidence: 0.7,
      });
    }

    if (data.idValidation?.format === 'invalid') {
      redFlags.push({
        severity: 'medium',
        category: 'identity',
        description: `ID number format invalid for type: ${data.idValidation.type}`,
        source: 'ID Validator',
        confidence: 0.9,
      });
    }

    if (data.aliases?.length > 3) {
      redFlags.push({
        severity: 'medium',
        category: 'identity',
        description: `Multiple aliases detected (${data.aliases.length}): ${data.aliases.join(', ')}`,
        source: 'Name Analysis',
        confidence: 0.6,
      });
    }

    const confidence = data.verificationStatus === 'verified' ? 0.85 :
                       data.verificationStatus === 'suspicious' ? 0.6 : 0.4;

    return this.formatResult(data, { redFlags, sources, confidence });
  }
}
