import puppeteer from 'puppeteer-core';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';
import { z } from 'zod';
import { constants as fsConstants } from 'node:fs';
import { access } from 'node:fs/promises';
import { isoToMinutes, loadConfig, normalizeRecipeUrl, sanitizeTerminalText } from '../utils/helpers.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface NutritionInfo {
  calories?: string | null;
  fatContent?: string | null;
  proteinContent?: string | null;
  carbohydrateContent?: string | null;
  fiberContent?: string | null;
  sugarContent?: string | null;
  sodiumContent?: string | null;
}

export interface Recipe {
  name?: string;
  description?: string;
  prepTime: number;
  cookTime: number;
  totalTime: number;
  servings: number;
  recipeIngredient?: string[];
  recipeInstructions?: Array<string | { text?: string; itemListElement?: Array<{ text?: string }> }>;
  nutrition?: NutritionInfo | null;
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
  '(KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';

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

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseTimeField(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  if (typeof value === 'string') {
    const mins = isoToMinutes(value.trim());
    return mins >= 0 ? mins : 0;
  }
  return 0;
}

function parseServings(value: unknown): number {
  const n = toFiniteNumber(value);
  if (n != null && n > 0) return Math.round(n);
  if (typeof value === 'string') {
    const match = value.match(/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }
  if (Array.isArray(value) && value.length > 0) {
    return parseServings(value[0]);
  }
  return 4;
}

function normalizeNutrition(value: unknown): NutritionInfo | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;

  const pick = (key: string): string | null => {
    const v = raw[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
    return null;
  };

  const info: NutritionInfo = {
    calories: pick('calories'),
    fatContent: pick('fatContent'),
    proteinContent: pick('proteinContent'),
    carbohydrateContent: pick('carbohydrateContent'),
    fiberContent: pick('fiberContent'),
    sugarContent: pick('sugarContent'),
    sodiumContent: pick('sodiumContent'),
  };

  const hasAny = Object.values(info).some(Boolean);
  return hasAny ? info : null;
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

  const prepTime = parseTimeField(recipe.prepTime);
  const cookTime = parseTimeField(recipe.cookTime);
  const totalTime = parseTimeField(recipe.totalTime) ||
    (prepTime || cookTime ? prepTime + cookTime : 0);

  return {
    name: normalizeText(recipe.name),
    description: normalizeText(recipe.description),
    prepTime,
    cookTime,
    totalTime,
    servings: parseServings(recipe.recipeYield ?? recipe.yield ?? recipe.servings),
    recipeIngredient,
    recipeInstructions: normalizeInstructions(recipe.recipeInstructions),
    nutrition: normalizeNutrition(recipe.nutrition),
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
      recipe.description ||
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
    Object.defineProperty(navigator, 'plugins', {
      get: () => Object.assign([{}, {}, {}], { length: 3, refresh: () => {} }),
    });
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

const AI_SYSTEM_PROMPT =
  'You are a precise recipe extractor. Return strictly minified JSON with keys: ' +
  'name, description, prepTime, cookTime, totalTime, servings, recipeIngredient, recipeInstructions, nutrition. ' +
  'Units: time values in minutes as numbers (e.g. 30, not "PT30M"); servings as a single number. ' +
  'recipeIngredient: array of plain strings (e.g. ["2 cups flour", "1 tsp salt"]). ' +
  'recipeInstructions: array of plain strings, one per step. ' +
  'nutrition: {calories, fatContent, proteinContent, carbohydrateContent, fiberContent, sugarContent, sodiumContent} ' +
  '(all optional strings, include units e.g. "25g", "500 calories"). Set nutrition to null if not available. ' +
  'If information is missing, use reasonable defaults (0 for times, 4 for servings). ' +
  'Use only the provided page content. Do not invent data.';

/**
 * Shape contract for the JSON returned by the AI recipe extractor.
 *
 * All fields are optional because the model may omit any of them; when it
 * does include a field, we require the correct shape so `normalizeAiRecipe`
 * can trust its input instead of silently swallowing shape drift.
 * Unknown keys are allowed to survive minor prompt/model changes.
 */
export const aiRecipeSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  prepTime: z.number().optional(),
  cookTime: z.number().optional(),
  totalTime: z.number().optional(),
  servings: z.number().optional(),
  recipeIngredient: z.array(z.string()).optional(),
  recipeInstructions: z
    .array(
      z.union([
        z.string(),
        z.object({
          text: z.string().optional(),
          itemListElement: z
            .array(z.object({ text: z.string().optional() }))
            .optional(),
        }),
      ]),
    )
    .optional(),
  nutrition: z
    .object({
      calories: z.string().nullish(),
      fatContent: z.string().nullish(),
      proteinContent: z.string().nullish(),
      carbohydrateContent: z.string().nullish(),
      fiberContent: z.string().nullish(),
      sugarContent: z.string().nullish(),
      sodiumContent: z.string().nullish(),
    })
    .nullish(),
});

/**
 * Parse + validate the raw AI response content. Throws a clear error if the
 * content is not valid JSON or does not match the expected recipe shape.
 */
export function parseAiRecipeResponse(content: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('AI response was invalid JSON');
  }

  const result = aiRecipeSchema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.') || '<root>';
    throw new Error(`AI response shape mismatch at ${path}: ${issue?.message ?? 'unknown'}`);
  }

  return result.data as Record<string, unknown>;
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
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: AI_SYSTEM_PROMPT,
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

  const recipe = normalizeAiRecipe(parseAiRecipeResponse(content));

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
