import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileCredentialStore, MemoryCredentialStore, tokenStoreExists } from '../src/services/credential-store.js';
import type { AuthSession } from '../src/services/auth-session.js';

const baseSession: AuthSession = {
  apiBaseUrl: 'https://parsely.us',
  accessToken: 'token',
  refreshToken: 'refresh',
  createdAt: 1,
  updatedAt: 2,
};

test('FileCredentialStore writes, reads, and clears sessions', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'parsely-cli-'));
  const filePath = join(dir, 'session.json');
  const store = new FileCredentialStore(filePath);

  try {
    await store.write(baseSession);

    assert.equal(await tokenStoreExists(filePath), true);
    assert.deepEqual(await store.read(), baseSession);

    const mode = (await stat(filePath)).mode & 0o777;
    assert.equal(mode, 0o600);

    await store.clear();
    assert.equal(await store.read(), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('MemoryCredentialStore keeps session state in process', async () => {
  const store = new MemoryCredentialStore();

  assert.equal(await store.read(), null);
  await store.write(baseSession);
  assert.deepEqual(await store.read(), baseSession);
  await store.clear();
  assert.equal(await store.read(), null);
});
