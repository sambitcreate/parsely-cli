import puppeteer from 'puppeteer-core';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { loadConfig } from '../utils/helpers.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface Recipe {
  name?: string;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  recipeIngredient?: string[];
  recipeInstructions?: Array<string | { text?: string; itemListElement?: Array<{ text?: string }> }>;
  source: 'browser' | 'ai';
}

export type ScrapePhase = 'browser' | 'parsing' | 'ai' | 'done' | 'error';

export interface ScrapeStatus {
  phase: ScrapePhase;
  message: string;
  recipe?: Recipe;
}

const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-blink-features=AutomationControlled',
];

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

/* ------------------------------------------------------------------ */
/*  JSON-LD helpers                                                    */
/* ------------------------------------------------------------------ */

/**
 * Walk through JSON-LD script blocks and return the first Recipe object found.
 * Handles direct Recipe type, @graph arrays, and nested lists.
 */
export function findRecipeJson(scripts: string[]): Record<string, unknown> | null {
  for (const raw of scripts) {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      continue;
    }

    const candidates: Record<string, unknown>[] = Array.isArray(data)
      ? (data as Record<string, unknown>[])
      : [data as Record<string, unknown>];

    // Use index-based loop because we may push into candidates as we go
    for (let i = 0; i < candidates.length; i++) {
      const obj = candidates[i];

      // Expand @graph
      if (obj['@graph']) {
        const graph = obj['@graph'];
        const items = Array.isArray(graph)
          ? (graph as Record<string, unknown>[])
          : [graph as Record<string, unknown>];
        candidates.push(...items);
      }

      const recipeType = obj['@type'];
      if (
        recipeType === 'Recipe' ||
        (Array.isArray(recipeType) && recipeType.includes('Recipe'))
      ) {
        return obj;
      }
    }
  }

  return null;
}

export function containsBrowserChallenge(html: string): boolean {
  return html.includes('cf_chl') ||
    html.includes('window._cf_chl_opt') ||
    html.includes('cf-mitigated');
}

export function extractRecipeFromHtml(html: string): Recipe | null {
  const $ = cheerio.load(html);
  const scripts: string[] = [];

  $('script[type="application/ld+json"]').each((_index, element) => {
    const text = $(element).text();
    if (text) scripts.push(text);
  });

  const recipe = findRecipeJson(scripts);
  return recipe ? ({ ...recipe, source: 'browser' } as Recipe) : null;
}

/* ------------------------------------------------------------------ */
/*  Chrome detection                                                   */
/* ------------------------------------------------------------------ */

const CHROME_PATHS = [
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];

function findChrome(): string | null {
  // Check well-known paths
  for (const p of CHROME_PATHS) {
    if (existsSync(p)) return p;
  }
  // Try `which`
  try {
    const result = execSync('which chromium-browser || which chromium || which google-chrome 2>/dev/null', { encoding: 'utf-8' }).trim();
    if (result) return result;
  } catch { /* not found */ }
  return null;
}

function createAbortError(): Error {
  const error = new Error('Scrape aborted');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

async function configurePage(page: Awaited<ReturnType<Awaited<ReturnType<typeof puppeteer.launch>>['newPage']>>) {
  await page.setUserAgent(BROWSER_USER_AGENT);
  await page.setExtraHTTPHeaders({ 'accept-language': 'en-US,en;q=0.9' });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
  });
}

/* ------------------------------------------------------------------ */
/*  Scraping strategies                                                */
/* ------------------------------------------------------------------ */

async function scrapeWithBrowser(
  url: string,
  onStatus?: (status: ScrapeStatus) => void,
  signal?: AbortSignal,
): Promise<Recipe | null> {
  throwIfAborted(signal);
  const chromePath = findChrome();
  if (!chromePath) return null; // No browser available – skip to AI

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  const onAbort = async () => {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // Ignore close errors when aborting.
      }
    }
  };

  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: chromePath,
      args: BROWSER_ARGS,
    });

    throwIfAborted(signal);
    const page = await browser.newPage();
    await configurePage(page);

    onStatus?.({ phase: 'browser', message: 'Loading recipe page…' });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 5_000 }).catch(() => undefined);

    throwIfAborted(signal);
    const html = await page.content();

    if (containsBrowserChallenge(html)) {
      onStatus?.({ phase: 'browser', message: 'Browser challenge detected, retrying page parsing…' });
      await page.waitForFunction(
        () => !document.documentElement.outerHTML.includes('cf_chl'),
        { timeout: 5_000 },
      ).catch(() => undefined);
    }

    throwIfAborted(signal);
    const settledHtml = await page.content();

    onStatus?.({ phase: 'parsing', message: 'Scanning recipe schema and JSON-LD blocks…' });
    await browser.close();
    browser = null;
    return extractRecipeFromHtml(settledHtml);
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
      throw createAbortError();
    }

    if (browser) {
      try { await browser.close(); } catch { /* noop */ }
    }
    return null;
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}

async function scrapeWithAI(url: string, signal?: AbortSignal): Promise<Recipe> {
  throwIfAborted(signal);
  const { openaiApiKey } = loadConfig();
  if (!openaiApiKey || openaiApiKey === 'YOUR_API_KEY_HERE') {
    throw new Error(
      'OpenAI API key not found. Create a .env.local file with OPENAI_API_KEY=your_key',
    );
  }

  const client = new OpenAI({ apiKey: openaiApiKey });
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a recipe scraper. Extract cookTime, prepTime, totalTime, ' +
          'recipeIngredient, and recipeInstructions from the provided URL. ' +
          'Return the data in a valid JSON object.',
      },
      { role: 'user', content: `Scrape this recipe: ${url}` },
    ],
    response_format: { type: 'json_object' },
  }, { signal });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('AI returned empty response');

  const recipe = JSON.parse(content) as Record<string, unknown>;
  return { ...recipe, source: 'ai' as const } as Recipe;
}

/* ------------------------------------------------------------------ */
/*  Public orchestrator                                                */
/* ------------------------------------------------------------------ */

/**
 * Scrape a recipe from the given URL.
 * Tries Puppeteer-based browser scraping first, falls back to OpenAI.
 * Calls `onStatus` with progress updates so the TUI can reflect each phase.
 */
export async function scrapeRecipe(
  url: string,
  onStatus: (status: ScrapeStatus) => void,
  signal?: AbortSignal,
): Promise<Recipe> {
  // Phase 1 – browser scraping
  onStatus({ phase: 'browser', message: 'Launching browser\u2026' });
  const browserResult = await scrapeWithBrowser(url, onStatus, signal);

  if (browserResult) {
    onStatus({ phase: 'done', message: 'Recipe found!', recipe: browserResult });
    return browserResult;
  }

  // Phase 2 – AI fallback
  onStatus({ phase: 'ai', message: 'Falling back to AI scraper\u2026' });

  try {
    const aiResult = await scrapeWithAI(url, signal);
    onStatus({ phase: 'done', message: 'Recipe extracted via AI!', recipe: aiResult });
    return aiResult;
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
      throw createAbortError();
    }

    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    onStatus({ phase: 'error', message });
    throw error;
  }
}
