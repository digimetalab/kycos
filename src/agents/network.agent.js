/**
 * @fileoverview Network Analysis Agent.
 * Corporate ownership traversal, beneficial owners, relationship graphs.
 */

import { BaseAgent } from '../core/base-agent.js';

export class NetworkAgent extends BaseAgent {
  constructor() {
    super({
      name: 'network',
      displayName: 'Network Analysis Agent',
      taskType: 'pattern_matching',
      systemPrompt: 'You are KYCOS Network Analysis Agent — a specialist in corporate structure and relationship mapping. Traverse ownership chains, identify beneficial owners, detect related party transactions, map cross-directorships, and construct relationship graphs. Use OpenCorporates and similar registries. Return structured JSON with entity list and adjacency relationships.',
      tools: ['opencorporates', 'corporate-registry'],
    });
  }

  async execute(target, context) {
    const redFlags = [];
    const sources = [];

    const prompt = `Perform network and corporate structure analysis for:
Name: ${target.name}
Type: ${target.type || 'individual'}
Company: ${target.company || 'N/A'}
Country: ${target.country || 'ID'}

Analyze:
1. Corporate ownership chain (direct + indirect)
2. Beneficial owner identification (>25% threshold per FATF)
3. Related party transaction patterns
4. Cross-directorship mapping
5. Nominee shareholder detection
6. Circular ownership patterns

Return JSON:
{
  "entities": [{ "name": "string", "type": "individual|corporation", "country": "string", "role": "director|shareholder|ubo|nominee", "ownership": 0.0 }],
  "relationships": [{ "from": "string", "to": "string", "type": "owns|directs|controls|related", "percentage": 0.0 }],
  "beneficialOwners": [{ "name": "string", "ownership": 0.0, "controlType": "direct|indirect|nominee", "verified": false }],
  "graph": { "nodes": 0, "edges": 0, "maxDepth": 0, "clusters": 0 },
  "riskIndicators": {
    "circularOwnership": false,
    "excessiveLayering": false,
    "jurisdictionRisk": ["string"],
    "nomineeUsage": false,
    "relatedPartyTransactions": 0,
    "crossDirectorships": 0
  }
}`;

    const { data } = await this.aiJSON(prompt);
    sources.push('AI Network Analysis');

    const risks = data.riskIndicators || {};

    if (risks.circularOwnership) {
      redFlags.push({
        severity: 'critical',
        category: 'corporate',
        description: 'Circular ownership structure detected — potential beneficial ownership concealment',
        source: 'Network Agent', confidence: 0.85,
      });
    }

    if (risks.excessiveLayering) {
      redFlags.push({
        severity: 'high',
        category: 'corporate',
        description: 'Excessive corporate layering detected (>3 levels) — opacity risk',
        source: 'Network Agent', confidence: 0.8,
      });
    }

    if (risks.nomineeUsage) {
      redFlags.push({
        severity: 'high',
        category: 'corporate',
        description: 'Nominee shareholder/director usage detected',
        source: 'Network Agent', confidence: 0.75,
      });
    }

    if (risks.jurisdictionRisk?.length > 0) {
      redFlags.push({
        severity: 'medium',
        category: 'aml',
        description: `High-risk jurisdictions in ownership chain: ${risks.jurisdictionRisk.join(', ')}`,
        source: 'Network Agent', confidence: 0.7,
      });
    }

    if (risks.crossDirectorships > 3) {
      redFlags.push({
        severity: 'medium',
        category: 'corporate',
        description: `${risks.crossDirectorships} cross-directorships detected — concentration risk`,
        source: 'Network Agent', confidence: 0.65,
      });
    }

    const confidence = data.entities?.length > 0 ? 0.7 : 0.3;
    return this.formatResult(data, { redFlags, sources, confidence });
  }
}
