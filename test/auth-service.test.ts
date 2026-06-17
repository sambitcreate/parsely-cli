import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../src/services/auth-service.js';
import { MemoryCredentialStore } from '../src/services/credential-store.js';
import type { AuthSession, ParselyRuntimeConfig } from '../src/services/auth-session.js';

function fakeJwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.signature`;
}

const config: ParselyRuntimeConfig = {
  apiBaseUrl: 'https://parsely.us',
  allowUnsafeTokenTarget: false,
  expectedTokenIssuer: 'https://convex.example',
};

test('currentSession hydrates expiry metadata for stored JWT sessions', async () => {
  const store = new MemoryCredentialStore();
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = fakeJwt({ exp, iss: 'https://convex.example' });
  await store.write({
    apiBaseUrl: 'https://parsely.us',
    accessToken: token,
    createdAt: 1,
    updatedAt: 2,
  });

  const session = await new AuthService(store, config).currentSession();

  assert.equal(session?.accessToken, token);
  assert.equal(session?.expiresAt, exp * 1000);
  assert.equal(session?.issuer, 'https://convex.example');
});

test('currentSession clears expired stored JWT sessions', async () => {
  const store = new MemoryCredentialStore();
  const expiredSession: AuthSession = {
    apiBaseUrl: 'https://parsely.us',
    accessToken: fakeJwt({ exp: 1, iss: 'https://convex.example' }),
    expiresAt: 1_000,
    issuer: 'https://convex.example',
    createdAt: 1,
    updatedAt: 2,
  };
  await store.write(expiredSession);

  const session = await new AuthService(store, config).currentSession();

  assert.equal(session, null);
  assert.equal(await store.read(), null);
});
