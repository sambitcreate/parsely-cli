import puppeteer from 'puppeteer-core';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';
import { constants as fsConstants } from 'node:fs';
import { access } from 'node:fs/promises';
import { loadConfig, normalizeRecipeUrl, sanitizeTerminalText } from '../utils/helpers.js';

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

const PAGE_TIMEOUT_MS = 20_000;
const NETWORK_IDLE_TIMEOUT_MS = 5_000;
const AI_TIMEOUT_MS = 30_000;
const AI_SOURCE_LIMIT = 120_000;

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

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const $ = cheerio.load(`<body>${sanitizeTerminalText(trimmed)}</body>`);
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  return text || undefined;
}

function normalizeInstruction(
  value: unknown,
): string | { text?: string; itemListElement?: Array<{ text?: string }> } | undefined {
  if (typeof value === 'string') {
    return normalizeText(value);
  }

  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const text = normalizeText((value as { text?: unknown }).text);
  const itemListElement = Array.isArray((value as { itemListElement?: unknown }).itemListElement)
    ? (value as { itemListElement: Array<{ text?: unknown }> }).itemListElement
        .map((item) => {
          const normalized = normalizeText(item?.text);
          return normalized ? { text: normalized } : null;
        })
        .filter((item): item is { text: string } => item !== null)
    : undefined;

  if (text) {
    return { text, ...(itemListElement && itemListElement.length > 0 ? { itemListElement } : {}) };
  }

  if (itemListElement && itemListElement.length > 0) {
    return { itemListElement };
  }

  return undefined;
}

function normalizeInstructions(
  value: unknown,
): Recipe['recipeInstructions'] | undefined {
  if (Array.isArray(value)) {
    const steps = value
      .map((step) => normalizeInstruction(step))
      .filter(
        (
          step,
        ): step is string | { text?: string; itemListElement?: Array<{ text?: string }> } =>
          Boolean(step),
      );

    return steps.length > 0 ? steps : undefined;
  }

  const single = normalizeInstruction(value);
  return single ? [single] : undefined;
}

function normalizeRecipePayload(
  recipe: Record<string, unknown>,
  source: Recipe['source'],
): Recipe {
  const recipeIngredient = Array.isArray(recipe.recipeIngredient)
    ? recipe.recipeIngredient
        .map((item) => normalizeText(item))
        .filter((item): item is string => Boolean(item))
    : undefined;

  return {
    name: normalizeText(recipe.name),
    prepTime: typeof recipe.prepTime === 'string' ? sanitizeTerminalText(recipe.prepTime.trim()) : undefined,
    cookTime: typeof recipe.cookTime === 'string' ? sanitizeTerminalText(recipe.cookTime.trim()) : undefined,
    totalTime: typeof recipe.totalTime === 'string' ? sanitizeTerminalText(recipe.totalTime.trim()) : undefined,
    recipeIngredient,
    recipeInstructions: normalizeInstructions(recipe.recipeInstructions),
    source,
  };
}

function normalizeBrowserRecipe(recipe: Record<string, unknown>): Recipe {
  return normalizeRecipePayload(recipe, 'browser');
}

export function normalizeAiRecipe(recipe: Record<string, unknown>): Recipe {
  return normalizeRecipePayload(recipe, 'ai');
}

function hasRecipeContent(recipe: Recipe): boolean {
  return Boolean(
    recipe.name ||
      recipe.prepTime ||
      recipe.cookTime ||
      recipe.totalTime ||
      recipe.recipeIngredient?.length ||
      recipe.recipeInstructions?.length,
  );
}

export function extractRecipeFromHtml(html: string): Recipe | null {
  const $ = cheerio.load(html);
  const scripts: string[] = [];

  $('script[type="application/ld+json"]').each((_index, element) => {
    const text = $(element).text();
    if (text) scripts.push(text);
  });

  const recipe = findRecipeJson(scripts);
  return recipe ? normalizeBrowserRecipe(recipe) : null;
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

async function findChrome(): Promise<string | null> {
  const candidates = [
    process.env['PUPPETEER_EXECUTABLE_PATH'],
    process.env['CHROME_PATH'],
    ...CHROME_PATHS,
  ].filter((path): path is string => Boolean(path));

  for (const candidate of candidates) {
    try {
      await access(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      // Try the next well-known location.
    }
  }

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

function createTimedSignal(
  signal: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();

  if (signal?.aborted) {
    controller.abort();
  }

  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

function formatTimeoutError(message: string, signal?: AbortSignal): Error {
  return signal?.aborted ? createAbortError() : new Error(message);
}

function limitAiSource(value: string): string {
  return value.trim().slice(0, AI_SOURCE_LIMIT);
}

async function fetchAiSource(url: string, signal?: AbortSignal): Promise<string> {
  throwIfAborted(signal);

  const { signal: timedSignal, cleanup } = createTimedSignal(signal, PAGE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        'accept-language': 'en-US,en;q=0.9',
        'user-agent': BROWSER_USER_AGENT,
      },
      signal: timedSignal,
    });

    if (!response.ok) {
      throw new Error(`Failed to load recipe page for AI fallback (${response.status})`);
    }

    return limitAiSource(await response.text());
  } catch (error) {
    if (timedSignal.aborted) {
      throw formatTimeoutError('Timed out loading recipe page for AI fallback', signal);
    }

    throw error;
  } finally {
    cleanup();
  }
}

/* ------------------------------------------------------------------ */
/*  Scraping strategies                                                */
/* ------------------------------------------------------------------ */

async function scrapeWithBrowser(
  url: string,
  onStatus?: (status: ScrapeStatus) => void,
  signal?: AbortSignal,
): Promise<{ recipe: Recipe | null; html?: string }> {
  throwIfAborted(signal);
  const chromePath = await findChrome();
  if (!chromePath) return { recipe: null }; // No browser available – skip to AI

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  let settledHtml: string | undefined;
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
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
    await page.waitForNetworkIdle({ idleTime: 500, timeout: NETWORK_IDLE_TIMEOUT_MS }).catch(() => undefined);

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
    settledHtml = await page.content();

    onStatus?.({ phase: 'parsing', message: 'Scanning recipe schema and JSON-LD blocks…' });
    return {
      recipe: extractRecipeFromHtml(settledHtml),
      html: settledHtml,
    };
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
      throw createAbortError();
    }

    onStatus?.({ phase: 'browser', message: 'Browser extraction failed. Preparing AI fallback…' });
    return { recipe: null, html: settledHtml };
  } finally {
    signal?.removeEventListener('abort', onAbort);
    if (browser) {
      try {
        await browser.close();
      } catch {
        // Ignore close errors during teardown.
      }
    }
  }
}

async function scrapeWithAI(url: string, pageSource: string, signal?: AbortSignal): Promise<Recipe> {
  throwIfAborted(signal);
  const { openaiApiKey } = loadConfig();
  if (!openaiApiKey || openaiApiKey === 'YOUR_API_KEY_HERE') {
    throw new Error(
      'OpenAI API key not found. Create a .env.local file with OPENAI_API_KEY=your_key',
    );
  }

  const client = new OpenAI({ apiKey: openaiApiKey });
  const { signal: timedSignal, cleanup } = createTimedSignal(signal, AI_TIMEOUT_MS);
  let response: Awaited<ReturnType<typeof client.chat.completions.create>>;

  try {
    response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You extract recipe data from supplied page content. Use only the provided page content. ' +
            'Return a JSON object with optional name, prepTime, cookTime, totalTime, recipeIngredient, and recipeInstructions fields.',
        },
        {
          role: 'user',
          content:
            `Recipe URL: ${url}\n\n` +
            'Page content:\n' +
            pageSource,
        },
      ],
      response_format: { type: 'json_object' },
    }, { signal: timedSignal });
  } catch (error) {
    if (timedSignal.aborted) {
      throw formatTimeoutError('AI recipe extraction timed out', signal);
    }

    throw error;
  } finally {
    cleanup();
  }

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('AI returned empty response');

  const recipe = normalizeAiRecipe(JSON.parse(content) as Record<string, unknown>);

  if (!hasRecipeContent(recipe)) {
    throw new Error('AI could not extract recipe data from the page');
  }

  return recipe;
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
  const normalizedUrl = normalizeRecipeUrl(url);
  if (!normalizedUrl) {
    const error = new Error('Invalid URL. Please enter a valid http or https recipe URL.');
    onStatus({ phase: 'error', message: error.message });
    throw error;
  }

  // Phase 1 – browser scraping
  onStatus({ phase: 'browser', message: 'Launching browser\u2026' });
  const browserResult = await scrapeWithBrowser(normalizedUrl, onStatus, signal);

  if (browserResult.recipe) {
    onStatus({ phase: 'done', message: 'Recipe found!', recipe: browserResult.recipe });
    return browserResult.recipe;
  }

  // Phase 2 – AI fallback
  onStatus({ phase: 'ai', message: 'Falling back to AI scraper\u2026' });

  try {
    const pageSource = browserResult.html && browserResult.html.trim()
      ? limitAiSource(browserResult.html)
      : await fetchAiSource(normalizedUrl, signal);
    const aiResult = await scrapeWithAI(normalizedUrl, pageSource, signal);
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
