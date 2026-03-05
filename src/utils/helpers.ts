import { config } from 'dotenv';
import { resolve } from 'path';

const ANSI_ESCAPE_PATTERN =
  /\u001B(?:\][^\u0007\u001B]*(?:\u0007|\u001B\\)|\[[0-?]*[ -/]*[@-~]|[@-Z\\-_])/g;
const CONTROL_CHAR_PATTERN = /[\u0000-\u0008\u000B-\u001A\u001C-\u001F\u007F-\u009F]/g;

/**
 * Convert an ISO 8601 duration string (e.g. "PT1H30M") to total minutes.
 * Returns -1 when the input is not parseable.
 */
export function isoToMinutes(duration: string | undefined): number {
  if (!duration || typeof duration !== 'string') return -1;

  const match = duration.match(
    /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/,
  );
  if (!match) return -1;

  const days = parseInt(match[1] || '0', 10);
  const hours = parseInt(match[2] || '0', 10);
  const minutes = parseInt(match[3] || '0', 10);
  const seconds = parseInt(match[4] || '0', 10);

  return days * 1440 + hours * 60 + minutes + Math.ceil(seconds / 60);
}

/**
 * Format minutes into a human-readable string (e.g. "1h 30m").
 */
export function formatMinutes(mins: number): string {
  if (mins < 0) return 'N/A';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Load environment configuration from .env.local.
 */
export function loadConfig(): { openaiApiKey?: string } {
  config({ path: resolve(process.cwd(), '.env.local') });
  return {
    openaiApiKey: process.env['OPENAI_API_KEY'],
  };
}

export function sanitizeTerminalText(input: string): string {
  return input
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(CONTROL_CHAR_PATTERN, '');
}

export function sanitizeSingleLineInput(input: string): string {
  return input.replace(/[\r\n]+/g, '');
}

export function normalizeRecipeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    return null;
  }

  const url = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  return isValidUrl(url) ? url : null;
}

export function getUrlHost(url?: string): string {
  if (!url) return '';

  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Basic URL validation.
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export type AppPhase = 'idle' | 'scraping' | 'display' | 'error';

export function buildOccurrenceKeys(items: string[]): string[] {
  const counts = new Map<string, number>();

  return items.map((item) => {
    const count = (counts.get(item) ?? 0) + 1;
    counts.set(item, count);
    return `${item}-${count}`;
  });
}
