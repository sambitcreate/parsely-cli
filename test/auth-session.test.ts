import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCanAttachToken,
  createEnvSession,
  decodeJwtTokenClaims,
  isSafeTokenTarget,
  normalizeApiBaseUrl,
  resolveRuntimeConfig,
  sessionIsExpired,
} from '../src/services/auth-session.js';

function fakeJwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.signature`;
}

test('normalizeApiBaseUrl defaults to production and strips trailing slash', () => {
  assert.equal(normalizeApiBaseUrl(undefined), 'https://parsely.us');
  assert.equal(normalizeApiBaseUrl('http://localhost:3000/'), 'http://localhost:3000');
});

test('token targets are limited to production and explicit local development hosts', () => {
  assert.equal(isSafeTokenTarget('https://parsely.us'), true);
  assert.equal(isSafeTokenTarget('http://localhost:3000'), true);
  assert.equal(isSafeTokenTarget('http://127.0.0.1:3000'), true);
  assert.equal(isSafeTokenTarget('http://[::1]:3000'), true);
  assert.equal(isSafeTokenTarget('https://evil.example'), false);
});

test('assertCanAttachToken refuses untrusted API hosts unless explicitly allowed', () => {
  assert.throws(
    () => assertCanAttachToken('https://evil.example'),
    /Refusing to send an auth token/,
  );
  assert.doesNotThrow(() => assertCanAttachToken('https://evil.example', true));
});

test('resolveRuntimeConfig reads CLI auth environment', () => {
  assert.deepEqual(
    resolveRuntimeConfig({
      PARSELY_API_BASE_URL: 'http://localhost:3000',
      PARSELY_AUTH_TOKEN: ' token ',
      PARSELY_TOKEN_STORE: '/tmp/parsely-session.json',
      PARSELY_ALLOW_UNTRUSTED_API_BASE_URL: '1',
      PARSELY_AUTH_TOKEN_ISSUER: 'https://convex.example',
    }),
    {
      apiBaseUrl: 'http://localhost:3000',
      envAuthToken: 'token',
      tokenStorePath: '/tmp/parsely-session.json',
      allowUnsafeTokenTarget: true,
      expectedTokenIssuer: 'https://convex.example',
    },
  );
});

test('createEnvSession returns a runtime session when PARSELY_AUTH_TOKEN is set', () => {
  const token = fakeJwt({ exp: 100, iss: 'https://convex.example' });
  const session = createEnvSession({
    apiBaseUrl: 'https://parsely.us',
    envAuthToken: token,
    allowUnsafeTokenTarget: false,
    expectedTokenIssuer: 'https://convex.example/',
  }, 1234);

  assert.equal(session?.accessToken, token);
  assert.equal(session?.apiBaseUrl, 'https://parsely.us');
  assert.equal(session?.createdAt, 1234);
  assert.equal(session?.expiresAt, 100_000);
  assert.equal(session?.issuer, 'https://convex.example');
});

test('decodeJwtTokenClaims reads JWT payload fields', () => {
  const token = fakeJwt({ exp: 123, iss: 'https://convex.example', sub: 'user-1' });
  assert.deepEqual(decodeJwtTokenClaims(token), {
    exp: 123,
    iss: 'https://convex.example',
    sub: 'user-1',
  });
  assert.equal(decodeJwtTokenClaims('not-a-jwt'), null);
});

test('createEnvSession rejects malformed, expired, and wrong-issuer tokens', () => {
  const config = {
    apiBaseUrl: 'https://parsely.us',
    allowUnsafeTokenTarget: false,
    expectedTokenIssuer: 'https://convex.example',
  };

  assert.throws(
    () => createEnvSession({ ...config, envAuthToken: 'not-a-jwt' }, 1),
    /JWT with an exp claim/,
  );
  assert.throws(
    () => createEnvSession({ ...config, envAuthToken: fakeJwt({ exp: 1, iss: 'https://convex.example' }) }, 1_000),
    /expired/,
  );
  assert.throws(
    () => createEnvSession({ ...config, envAuthToken: fakeJwt({ exp: 100, iss: 'https://other.example' }) }, 1_000),
    /issuer/,
  );
});

test('sessionIsExpired refuses missing and near-expiry sessions', () => {
  assert.equal(sessionIsExpired(null), true);
  assert.equal(sessionIsExpired({}), true);
  assert.equal(sessionIsExpired({ expiresAt: 10_000 }, 11_000), true);
  assert.equal(sessionIsExpired({ expiresAt: 10_000 }, 9_000), true);
  assert.equal(sessionIsExpired({ expiresAt: 60_000 }, 9_000), false);
});
