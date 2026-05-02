/**
 * @fileoverview KYCOS Scraper — Playwright + Cheerio + Axios scraping layer.
 * Provides static and dynamic page scraping with rate limiting,
 * user-agent rotation, and cache integration.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { createLogger } from '../utils/logger.js';
import { cacheGet, cacheSet } from './cache.js';

const logger = createLogger('Scraper');

/** User agent pool for rotation */
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
];

/** Rate limiter state */
let lastRequestMs = 0;
const RATE_LIMIT_MS = parseInt(process.env.KYCOS_RATE_LIMIT_MS || '1000', 10);

/**
 * Enforce rate limiting between requests.
 */
async function rateLimit() {
  const elapsed = Date.now() - lastRequestMs;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
  }
  lastRequestMs = Date.now();
}

/**
 * Get a random user agent from the pool.
 * @returns {string}
 */
function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Fetch a page using Axios + Cheerio (static HTML only).
 * @param {string} url - URL to fetch
 * @param {Object} [options={}]
 * @param {number} [options.cacheTtlMs=86400000] - Cache TTL
 * @param {number} [options.timeout=30000] - Request timeout
 * @returns {Promise<{ html: string, $: cheerio.CheerioAPI, status: number }>}
 */
export async function fetchPage(url, options = {}) {
  const { cacheTtlMs = 86_400_000, timeout = 30_000 } = options;

  // Check cache
  const cacheKey = `scrape:${url}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    logger.debug(`Cache hit: ${url}`);
    return { html: cached.html, $: cheerio.load(cached.html), status: 200 };
  }

  await rateLimit();

  try {
    const response = await axios.get(url, {
      timeout,
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      maxRedirects: 5,
    });

    const html = response.data;
    cacheSet(cacheKey, { html, fetchedAt: new Date().toISOString() }, cacheTtlMs);
    logger.debug(`Fetched: ${url} (${response.status})`);

    return { html, $: cheerio.load(html), status: response.status };
  } catch (err) {
    logger.warn(`Fetch failed for ${url}: ${err.message}`);
    throw err;
  }
}

/**
 * Scrape a dynamic (JavaScript-rendered) page using Playwright.
 * @param {string} url - URL to scrape
 * @param {Object} [options={}]
 * @param {string} [options.waitForSelector] - CSS selector to wait for
 * @param {number} [options.timeout=30000] - Navigation timeout
 * @param {boolean} [options.screenshot=false] - Capture screenshot
 * @returns {Promise<{ html: string, $: cheerio.CheerioAPI, screenshot?: Buffer }>}
 */
export async function scrapeDynamic(url, options = {}) {
  const { waitForSelector, timeout = 30_000, screenshot = false } = options;

  // Lazy import playwright to avoid loading it when not needed
  const { chromium } = await import('playwright');

  await rateLimit();

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: randomUA(),
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    await page.goto(url, { timeout, waitUntil: 'networkidle' });

    if (waitForSelector) {
      await page.waitForSelector(waitForSelector, { timeout });
    }

    const html = await page.content();
    const result = { html, $: cheerio.load(html) };

    if (screenshot) {
      result.screenshot = await page.screenshot({ fullPage: true });
    }

    logger.debug(`Dynamic scrape: ${url}`);
    return result;
  } catch (err) {
    logger.warn(`Dynamic scrape failed for ${url}: ${err.message}`);
    throw err;
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Extract structured data from a Cheerio instance using CSS selectors.
 * @param {cheerio.CheerioAPI} $ - Cheerio instance
 * @param {Record<string, string>} selectors - Map of field name → CSS selector
 * @returns {Record<string, string>}
 */
export function extractFields($, selectors) {
  const result = {};
  for (const [field, selector] of Object.entries(selectors)) {
    result[field] = $(selector).first().text().trim() || null;
  }
  return result;
}
