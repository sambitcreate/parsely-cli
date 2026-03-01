import { config } from 'dotenv';
import { resolve } from 'path';

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

export function sanitizeSingleLineInput(input: string): string {
  return input.replace(/[\r\n]+/g, '');
}

export function normalizeRecipeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

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
