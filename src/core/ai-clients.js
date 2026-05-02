/**
 * @fileoverview KYCOS AI Clients — unified provider SDK wrappers.
 * Lazy-initialized singletons for Anthropic, Gemini, OpenRouter, and Ollama.
 */

import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('AIClients');

// ─── Singletons ────────────────────────────────────────────────

/** @type {Anthropic|null} */
let anthropicClient = null;

/** @type {GoogleGenerativeAI|null} */
let geminiClient = null;

/** @type {OpenAI|null} */
let openrouterClient = null;

/** @type {OpenAI|null} */
let ollamaClient = null;

// ─── Getters ───────────────────────────────────────────────────

/**
 * Get or create the Anthropic client singleton.
 * @returns {Anthropic}
 */
export function getAnthropicClient() {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set in environment');
    anthropicClient = new Anthropic({ apiKey });
    logger.info('Anthropic client initialized');
  }
  return anthropicClient;
}

/**
 * Get or create the Gemini client singleton.
 * @returns {GoogleGenerativeAI}
 */
export function getGeminiClient() {
  if (!geminiClient) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not set in environment');
    geminiClient = new GoogleGenerativeAI(apiKey);
    logger.info('Gemini client initialized');
  }
  return geminiClient;
}

/**
 * Get or create the OpenRouter client singleton.
 * Uses OpenAI SDK pointed at OpenRouter's base URL.
 * @returns {OpenAI}
 */
export function getOpenRouterClient() {
  if (!openrouterClient) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY not set in environment');
    openrouterClient = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
      defaultHeaders: {
        'HTTP-Referer': 'https://kycos.local',
        'X-Title': 'KYCOS Intelligence',
      },
    });
    logger.info('OpenRouter client initialized');
  }
  return openrouterClient;
}

/**
 * Get or create the Ollama client singleton.
 * Uses OpenAI SDK pointed at local Ollama instance.
 * @returns {OpenAI}
 */
export function getOllamaClient() {
  if (!ollamaClient) {
    const baseURL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    ollamaClient = new OpenAI({
      baseURL: `${baseURL}/v1`,
      apiKey: 'ollama',
    });
    logger.info(`Ollama client initialized at ${baseURL}`);
  }
  return ollamaClient;
}

// ─── Completion Wrappers ───────────────────────────────────────

/**
 * Send a completion via Anthropic Claude.
 * @param {Object} opts
 * @returns {Promise<{ content: string, usage: Object, model: string }>}
 */
export async function claudeComplete({ model = 'claude-haiku-4-5-20250415', systemPrompt, userMessage, maxTokens = 4096, temperature = 0.3, jsonMode = false }) {
  const client = getAnthropicClient();
  const messages = [{ role: 'user', content: jsonMode ? userMessage + '\n\nRespond ONLY with valid JSON. No markdown, no explanation.' : userMessage }];

  const startMs = performance.now();
  const response = await client.messages.create({ model, max_tokens: maxTokens, temperature, system: systemPrompt, messages });
  logger.timing(`Claude ${model}`, Math.round(performance.now() - startMs));

  const content = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
  return { content, usage: response.usage, model: response.model };
}

/**
 * Send a completion via Google Gemini.
 * @param {Object} opts
 * @returns {Promise<{ content: string, usage: Object, model: string }>}
 */
export async function geminiComplete({ model = 'gemini-2.0-flash', systemPrompt, userMessage, maxTokens = 4096, temperature = 0.3, jsonMode = false }) {
  const ai = getGeminiClient();
  const generationConfig = { maxOutputTokens: maxTokens, temperature };
  if (jsonMode) generationConfig.responseMimeType = 'application/json';

  const geminiModel = ai.getGenerativeModel({ model, systemInstruction: systemPrompt, generationConfig });
  const startMs = performance.now();
  const result = await geminiModel.generateContent(userMessage);
  logger.timing(`Gemini ${model}`, Math.round(performance.now() - startMs));

  const response = result.response;
  return { content: response.text(), usage: response.usageMetadata || {}, model };
}

/**
 * Send a completion via OpenRouter (OpenAI-compatible).
 * @param {Object} opts
 * @returns {Promise<{ content: string, usage: Object, model: string }>}
 */
export async function openrouterComplete({ model = 'openai/gpt-4o', systemPrompt, userMessage, maxTokens = 4096, temperature = 0.3, jsonMode = false }) {
  const client = getOpenRouterClient();
  const params = {
    model,
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
    max_tokens: maxTokens,
    temperature,
  };
  if (jsonMode) params.response_format = { type: 'json_object' };

  const startMs = performance.now();
  const response = await client.chat.completions.create(params);
  logger.timing(`OpenRouter ${model}`, Math.round(performance.now() - startMs));

  return { content: response.choices[0]?.message?.content || '', usage: response.usage || {}, model: response.model || model };
}

/**
 * Send a completion via local Ollama.
 * @param {Object} opts
 * @returns {Promise<{ content: string, usage: Object, model: string }>}
 */
export async function ollamaComplete({ model, systemPrompt, userMessage, maxTokens = 4096, temperature = 0.3, jsonMode = false }) {
  model = model || process.env.OLLAMA_MODEL || 'llama3.1';
  const client = getOllamaClient();
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: jsonMode ? userMessage + '\n\nRespond ONLY with valid JSON.' : userMessage },
  ];
  const params = { model, messages, max_tokens: maxTokens, temperature };
  if (jsonMode) params.response_format = { type: 'json_object' };

  const startMs = performance.now();
  const response = await client.chat.completions.create(params);
  logger.timing(`Ollama ${model}`, Math.round(performance.now() - startMs));

  return { content: response.choices[0]?.message?.content || '', usage: response.usage || {}, model };
}

/**
 * Check if Ollama is available locally.
 * @returns {Promise<boolean>}
 */
export async function isOllamaAvailable() {
  try {
    const baseURL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const response = await fetch(`${baseURL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Parse a JSON response, stripping markdown fences if present.
 * @param {string} text - Raw LLM response
 * @returns {Object} Parsed JSON
 */
export function parseJSON(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  return JSON.parse(cleaned);
}
