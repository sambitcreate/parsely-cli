import { config } from 'dotenv';
import { resolve } from 'path';
import net from 'node:net';

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

const PRIVATE_IPV4_PATTERN =
  /^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|169\.254\.|0\.)/;

/**
 * Decode an IPv4-mapped IPv6 address to its embedded IPv4 dotted form.
 * Handles both unnormalized (`::ffff:127.0.0.1`) and normalized
 * (`::ffff:7f00:1`) representations that Node's URL parser can produce.
 */
function ipv4FromMappedIpv6(host: string): string | null {
  const dotted = host.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (dotted) return dotted[1]!;

  const hex = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (hex) {
    const high = parseInt(hex[1]!, 16);
    const low = parseInt(hex[2]!, 16);
    if (Number.isNaN(high) || Number.isNaN(low)) return null;
    return `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
  }
  return null;
}

/**
 * Validates that a URL is a well-formed http(s) URL targeting a public host.
 *
 * Rejects:
 *   - non-http(s) schemes (file:, javascript:, data:, etc.)
 *   - localhost and mDNS hostnames (.internal, .local)
 *   - loopback / link-local / private IPv4 ranges (RFC 1918)
 *   - cloud metadata endpoint 169.254.169.254
 *   - loopback / unique-local / link-local IPv6 (::1, fc00::/7, fe80::/10)
 *
 * This guards against SSRF when a user (or an attacker via a piped script)
 * submits a URL that resolves to an internal resource.
 */
export function isValidUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  // URL.hostname wraps IPv6 literals in brackets; strip them for net.isIP.
  const rawHost = parsed.hostname.toLowerCase();
  const host = rawHost.startsWith('[') && rawHost.endsWith(']')
    ? rawHost.slice(1, -1)
    : rawHost;

  if (!host) return false;

  if (host === 'localhost' || host.endsWith('.localhost')) return false;
  if (host.endsWith('.internal') || host.endsWith('.local')) return false;

  const ipVersion = net.isIP(host);
  if (ipVersion === 4) {
    if (PRIVATE_IPV4_PATTERN.test(host)) return false;
  } else if (ipVersion === 6) {
    if (host === '::1' || host === '::') return false;
    // Link-local fe80::/10 and unique-local fc00::/7 (fc.. / fd..).
    if (host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) {
      return false;
    }
    // IPv4-mapped IPv6 — Node may normalize ::ffff:127.0.0.1 → ::ffff:7f00:1,
    // so decode either form and check against the private v4 ranges.
    const mapped = ipv4FromMappedIpv6(host);
    if (mapped && PRIVATE_IPV4_PATTERN.test(mapped)) return false;
  }

  return true;
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
