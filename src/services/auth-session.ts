export const DEFAULT_PARSELY_API_BASE_URL = 'https://parsely.us';

export interface AuthSession {
  apiBaseUrl: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ParselyRuntimeConfig {
  apiBaseUrl: string;
  envAuthToken?: string;
  tokenStorePath?: string;
  allowUnsafeTokenTarget: boolean;
}

export type EnvMap = Record<string, string | undefined>;

export function normalizeApiBaseUrl(value: string | undefined): string {
  const raw = value?.trim() || DEFAULT_PARSELY_API_BASE_URL;
  const parsed = new URL(raw);
  parsed.hash = '';
  parsed.search = '';
  return parsed.toString().replace(/\/$/, '');
}

export function isSafeTokenTarget(apiBaseUrl: string): boolean {
  const parsed = new URL(apiBaseUrl);
  const hostname = parsed.hostname.toLowerCase();

  if (parsed.protocol === 'https:' && hostname === 'parsely.us') {
    return true;
  }

  return (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
    (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]');
}

export function resolveRuntimeConfig(env: EnvMap = process.env): ParselyRuntimeConfig {
  return {
    apiBaseUrl: normalizeApiBaseUrl(env.PARSELY_API_BASE_URL),
    envAuthToken: env.PARSELY_AUTH_TOKEN?.trim() || undefined,
    tokenStorePath: env.PARSELY_TOKEN_STORE?.trim() || undefined,
    allowUnsafeTokenTarget: env.PARSELY_ALLOW_UNTRUSTED_API_BASE_URL === '1',
  };
}

export function assertCanAttachToken(
  apiBaseUrl: string,
  allowUnsafeTokenTarget = false,
): void {
  if (allowUnsafeTokenTarget || isSafeTokenTarget(apiBaseUrl)) {
    return;
  }

  throw new Error(
    `Refusing to send an auth token to untrusted Parsely API host: ${apiBaseUrl}`,
  );
}

export function sessionIsExpired(
  session: Pick<AuthSession, 'expiresAt'> | null,
  now = Date.now(),
): boolean {
  if (!session?.expiresAt) {
    return false;
  }

  return session.expiresAt <= now;
}

export function createEnvSession(config: ParselyRuntimeConfig, now = Date.now()): AuthSession | null {
  if (!config.envAuthToken) {
    return null;
  }

  assertCanAttachToken(config.apiBaseUrl, config.allowUnsafeTokenTarget);

  return {
    apiBaseUrl: config.apiBaseUrl,
    accessToken: config.envAuthToken,
    createdAt: now,
    updatedAt: now,
  };
}
