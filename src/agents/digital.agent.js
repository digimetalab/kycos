/**
 * @fileoverview Digital Footprint Agent.
 * WHOIS, Shodan, HaveIBeenPwned, email breach, dark web detection.
 */

import { BaseAgent } from '../core/base-agent.js';

export class DigitalAgent extends BaseAgent {
  constructor() {
    super({
      name: 'digital',
      displayName: 'Digital Footprint Agent',
      taskType: 'data_extraction',
      systemPrompt: 'You are KYCOS Digital Footprint Agent — a specialist in digital OSINT. Perform WHOIS domain lookups, check Shodan for device/service exposure, query HaveIBeenPwned for email breaches, assess email reputation, and detect dark web mentions. Return structured JSON with all findings and risk assessments.',
      tools: ['whois', 'shodan', 'hibp'],
    });
  }

  async execute(target, context) {
    const redFlags = [];
    const sources = [];

    const prompt = `Perform digital footprint OSINT analysis for:
Name: ${target.name}
Email: ${target.email || 'Not provided'}
Company: ${target.company || 'N/A'}
Country: ${target.country || 'ID'}

Analyze:
1. WHOIS domain lookups for associated domains
2. Shodan device/service exposure
3. HaveIBeenPwned email breach check
4. Email reputation and deliverability
5. Dark web mention indicators
6. Digital infrastructure assessment

Return JSON:
{
  "domains": [{ "domain": "string", "registrar": "string", "created": "string", "expires": "string", "privacy": false, "nameservers": ["string"] }],
  "exposures": [{ "ip": "string", "port": 0, "service": "string", "vulnerability": "string", "severity": "low|medium|high|critical" }],
  "breaches": [{ "name": "string", "date": "string", "dataTypes": ["string"], "records": 0 }],
  "emailRisk": { "score": 0.0, "disposable": false, "reputation": "good|neutral|poor", "breachCount": 0 },
  "darkWebMentions": [{ "source": "string", "context": "string", "date": "string", "severity": "low|medium|high" }],
  "infrastructure": { "hosting": "string", "ssl": true, "securityHeaders": true, "overallGrade": "A|B|C|D|F" }
}`;

    const { data } = await this.aiJSON(prompt);
    sources.push('AI Digital OSINT');

    // Data breach flags
    if (data.breaches?.length > 0) {
      const total = data.breaches.length;
      redFlags.push({
        severity: total > 5 ? 'high' : 'medium',
        category: 'digital',
        description: `Email found in ${total} data breach(es): ${data.breaches.map(b => b.name).join(', ')}`,
        source: 'HIBP Check',
        confidence: 0.85,
      });
    }

    // Critical exposures
    const critExposures = (data.exposures || []).filter(e => e.severity === 'critical');
    if (critExposures.length > 0) {
      redFlags.push({
        severity: 'high',
        category: 'digital',
        description: `${critExposures.length} critical security exposure(s) found`,
        source: 'Shodan',
        confidence: 0.8,
      });
    }

    // Dark web mentions
    const highDarkWeb = (data.darkWebMentions || []).filter(m => m.severity === 'high');
    if (highDarkWeb.length > 0) {
      redFlags.push({
        severity: 'high',
        category: 'digital',
        description: `${highDarkWeb.length} high-severity dark web mention(s) detected`,
        source: 'Dark Web Monitor',
        confidence: 0.6,
      });
    }

    // Disposable email
    if (data.emailRisk?.disposable) {
      redFlags.push({
        severity: 'medium',
        category: 'identity',
        description: 'Target using disposable/temporary email address',
        source: 'Email Analysis',
        confidence: 0.9,
      });
    }

    const confidence = data.domains?.length > 0 || data.breaches?.length >= 0 ? 0.7 : 0.4;
    return this.formatResult(data, { redFlags, sources, confidence });
  }
}
