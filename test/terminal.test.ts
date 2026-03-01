import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import {
  createSynchronizedWriteProxy,
  getRenderableHeight,
  shouldUseSynchronizedOutput,
} from '../src/utils/terminal.js';

test('getRenderableHeight keeps one row free for Ink incremental rendering', () => {
  assert.equal(getRenderableHeight(24), 23);
  assert.equal(getRenderableHeight(2), 1);
  assert.equal(getRenderableHeight(1), 1);
});

test('shouldUseSynchronizedOutput defaults to Ghostty and honors overrides', () => {
  assert.equal(shouldUseSynchronizedOutput({ TERM_PROGRAM: 'ghostty' }), true);
  assert.equal(shouldUseSynchronizedOutput({ TERM_PROGRAM: 'ghostty', PARSELY_SYNC_OUTPUT: '0' }), false);
  assert.equal(shouldUseSynchronizedOutput({ TERM_PROGRAM: 'Apple_Terminal', PARSELY_SYNC_OUTPUT: '1' }), true);
});

test('createSynchronizedWriteProxy wraps output in synchronized paint escapes', async () => {
  class MockStdout extends PassThrough {
    columns = 80;
    rows = 24;
    isTTY = true;
  }

  const stdout = new MockStdout();
  const proxy = createSynchronizedWriteProxy(stdout);
  const chunks: string[] = [];

  stdout.on('data', (chunk) => {
    chunks.push(chunk.toString('utf8'));
  });

  proxy.write('hello');
  proxy.end();

  await new Promise((resolve) => stdout.on('finish', resolve));

  assert.deepEqual(chunks, ['\u001B[?2026hhello\u001B[?2026l']);
});
