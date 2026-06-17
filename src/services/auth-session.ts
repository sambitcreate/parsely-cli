export const DEFAULT_PARSELY_API_BASE_URL = 'https://parsely.us';
const TOKEN_EXPIRY_SKEW_MS = 30_000;

export interface AuthSession {
  apiBaseUrl: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  issuer?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ParselyRuntimeConfig {
  apiBaseUrl: string;
  envAuthToken?: string;
  tokenStorePath?: string;
  allowUnsafeTokenTarget: boolean;
  expectedTokenIssuer?: string;
}

export type EnvMap = Record<string, string | undefined>;

export interface JwtTokenClaims {
  exp?: number;
  iat?: number;
  iss?: string;
  sub?: string;
}

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
    expectedTokenIssuer: env.PARSELY_AUTH_TOKEN_ISSUER?.trim() || undefined,
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
    return true;
  }

  return session.expiresAt <= now + TOKEN_EXPIRY_SKEW_MS;
}

export function decodeJwtTokenClaims(token: string): JwtTokenClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) {
    return null;
  }

  try {
    const json = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64url').toString('utf8');
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? parsed as JwtTokenClaims : null;
  } catch {
    return null;
  }
}

function normalizeIssuer(value: string): string {
  return value.replace(/\/$/, '');
}

function assertTokenIssuer(claims: JwtTokenClaims, expectedIssuer?: string): void {
  if (!expectedIssuer) {
    return;
  }

  if (!claims.iss || normalizeIssuer(claims.iss) !== normalizeIssuer(expectedIssuer)) {
    throw new Error('PARSELY_AUTH_TOKEN issuer does not match PARSELY_AUTH_TOKEN_ISSUER.');
  }
}

export function createSessionFromAccessToken(
  config: ParselyRuntimeConfig,
  accessToken: string,
  now = Date.now(),
  existingTimestamps?: Pick<AuthSession, 'createdAt' | 'updatedAt'>,
): AuthSession {
  assertCanAttachToken(config.apiBaseUrl, config.allowUnsafeTokenTarget);

  const claims = decodeJwtTokenClaims(accessToken);
  if (!claims || typeof claims.exp !== 'number' || !Number.isFinite(claims.exp)) {
    throw new Error('PARSELY_AUTH_TOKEN must be a Convex Auth JWT with an exp claim.');
  }

  assertTokenIssuer(claims, config.expectedTokenIssuer);

  const expiresAt = claims.exp * 1000;
  if (expiresAt <= now + TOKEN_EXPIRY_SKEW_MS) {
    throw new Error('PARSELY_AUTH_TOKEN is expired. Sign in again and provide a fresh token.');
  }

  return {
    apiBaseUrl: config.apiBaseUrl,
    accessToken,
    expiresAt,
    issuer: claims.iss,
    createdAt: existingTimestamps?.createdAt ?? now,
    updatedAt: existingTimestamps?.updatedAt ?? now,
  };
}

export function refreshStoredSession(
  session: AuthSession,
  config: ParselyRuntimeConfig,
  now = Date.now(),
): AuthSession {
  return {
    ...createSessionFromAccessToken(config, session.accessToken, now, session),
    refreshToken: session.refreshToken,
  };
}

export function createEnvSession(config: ParselyRuntimeConfig, now = Date.now()): AuthSession | null {
  if (!config.envAuthToken) {
    return null;
  }

  return createSessionFromAccessToken(config, config.envAuthToken, now);
}
