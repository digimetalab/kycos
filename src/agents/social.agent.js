/**
 * @fileoverview Social Intelligence Agent.
 * Discovers and analyzes social media presence, sentiment, and connections.
 */

import { BaseAgent } from '../core/base-agent.js';

export class SocialAgent extends BaseAgent {
  constructor() {
    super({
      name: 'social',
      displayName: 'Social Intelligence Agent',
      taskType: 'data_extraction',
      systemPrompt: 'You are KYCOS Social Intelligence Agent — a specialist in social media OSINT and sentiment analysis. Discover and analyze the target\'s presence on LinkedIn, Facebook, Instagram, Twitter/X, and other platforms. Extract connections, analyze sentiment of public posts, identify lifestyle indicators, and flag inconsistencies. Return structured JSON.',
      tools: ['web-scraper', 'sentiment-analyzer'],
    });
  }

  async execute(target, context) {
    const redFlags = [];
    const sources = [];

    const prompt = `Perform social media OSINT analysis for KYC:
Name: ${target.name}
Type: ${target.type || 'individual'}
Country: ${target.country || 'ID'}
Email: ${target.email || 'Not provided'}
Company: ${target.company || 'Not provided'}

Analyze:
1. Social media profiles (LinkedIn, Facebook, Instagram, Twitter/X)
2. Sentiment analysis on public posts
3. Connection/follower network quality
4. Activity patterns (frequency, consistency)
5. Lifestyle indicators vs declared income
6. Professional history consistency

Return JSON:
{
  "profiles": [{ "platform": "string", "url": "string", "verified": false, "followers": 0, "activity": "active|inactive|suspicious" }],
  "sentiment": { "overall": "positive|neutral|negative|mixed", "score": 0.0, "keyTopics": ["string"] },
  "connections": { "totalMapped": 0, "notableConnections": ["string"], "networkQuality": "high|medium|low" },
  "activityScore": 0.0,
  "lifestyleIndicators": { "apparentWealth": "high|medium|low", "consistentWithProfile": true, "details": "string" },
  "professionalHistory": { "consistent": true, "gaps": [], "details": "string" },
  "riskIndicators": ["string"]
}`;

    const { data } = await this.aiJSON(prompt);
    sources.push('AI Social Analysis');

    // Flag lifestyle inconsistencies
    if (data.lifestyleIndicators?.consistentWithProfile === false) {
      redFlags.push({
        severity: 'medium',
        category: 'aml',
        description: `Lifestyle inconsistent with declared profile: ${data.lifestyleIndicators.details}`,
        source: 'Social Agent',
        confidence: 0.6,
      });
    }

    // Flag suspicious activity patterns
    const suspiciousProfiles = data.profiles?.filter(p => p.activity === 'suspicious') || [];
    if (suspiciousProfiles.length > 0) {
      redFlags.push({
        severity: 'medium',
        category: 'identity',
        description: `Suspicious social media activity on: ${suspiciousProfiles.map(p => p.platform).join(', ')}`,
        source: 'Social Agent',
        confidence: 0.5,
      });
    }

    // Flag negative sentiment
    if (data.sentiment?.overall === 'negative' && data.sentiment?.score < -0.5) {
      redFlags.push({
        severity: 'low',
        category: 'reputation',
        description: `Predominantly negative sentiment detected (score: ${data.sentiment.score})`,
        source: 'Sentiment Analysis',
        confidence: 0.5,
      });
    }

    const confidence = data.profiles?.length > 0 ? 0.7 : 0.3;
    return this.formatResult(data, { redFlags, sources, confidence });
  }
}
