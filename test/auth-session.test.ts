import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCanAttachToken,
  createEnvSession,
  isSafeTokenTarget,
  normalizeApiBaseUrl,
  resolveRuntimeConfig,
  sessionIsExpired,
} from '../src/services/auth-session.js';

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
    }),
    {
      apiBaseUrl: 'http://localhost:3000',
      envAuthToken: 'token',
      tokenStorePath: '/tmp/parsely-session.json',
      allowUnsafeTokenTarget: true,
    },
  );
});

test('createEnvSession returns a runtime session when PARSELY_AUTH_TOKEN is set', () => {
  const session = createEnvSession({
    apiBaseUrl: 'https://parsely.us',
    envAuthToken: 'token',
    allowUnsafeTokenTarget: false,
  }, 1234);

  assert.equal(session?.accessToken, 'token');
  assert.equal(session?.apiBaseUrl, 'https://parsely.us');
  assert.equal(session?.createdAt, 1234);
});

test('sessionIsExpired treats sessions without expiry as valid', () => {
  assert.equal(sessionIsExpired(null), false);
  assert.equal(sessionIsExpired({}), false);
  assert.equal(sessionIsExpired({ expiresAt: 10 }, 11), true);
  assert.equal(sessionIsExpired({ expiresAt: 10 }, 9), false);
});
