/**
 * @fileoverview Tests for AI Router model selection and fallback logic.
 */

import { describe, it, expect } from 'vitest';
import { resolveRoute } from '../../src/core/ai-router.js';

describe('AI Router', () => {
  it('routes narrative_synthesis to Claude Opus', () => {
    const route = resolveRoute('narrative_synthesis');
    expect(route.provider).toBe('claude');
    expect(route.model).toContain('opus');
  });

  it('routes data_extraction to Gemini Flash', () => {
    const route = resolveRoute('data_extraction');
    expect(route.provider).toBe('gemini');
    expect(route.model).toContain('flash');
  });

  it('routes pattern_matching to OpenRouter GPT-4o', () => {
    const route = resolveRoute('pattern_matching');
    expect(route.provider).toBe('openrouter');
    expect(route.model).toContain('gpt-4o');
  });

  it('routes privacy_mode to Ollama', () => {
    const route = resolveRoute('privacy_mode');
    expect(route.provider).toBe('ollama');
  });

  it('routes cost_sensitive to Claude Haiku', () => {
    const route = resolveRoute('cost_sensitive');
    expect(route.provider).toBe('claude');
    expect(route.model).toContain('haiku');
  });

  it('falls back to cost_sensitive for unknown task type', () => {
    const route = resolveRoute('unknown_task');
    expect(route.provider).toBe('claude');
    expect(route.model).toContain('haiku');
  });
});
