import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import {
  createSynchronizedWriteProxy,
  getRenderableHeight,
  resetDefaultTerminalBackground,
  setDefaultTerminalBackground,
  shouldUseDisplayPalette,
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

test('shouldUseSynchronizedOutput recognizes supported terminal env matrices', () => {
  const cases = [
    {
      name: 'Ghostty on macOS',
      env: { TERM_PROGRAM: 'ghostty', TERM: 'xterm-ghostty' },
      expected: true,
    },
    {
      name: 'WezTerm on Linux',
      env: { TERM_PROGRAM: 'WezTerm', TERM: 'wezterm' },
      expected: true,
    },
    {
      name: 'Kitty on Linux',
      env: { TERM: 'xterm-kitty' },
      expected: true,
    },
    {
      name: 'Apple Terminal on macOS',
      env: { TERM_PROGRAM: 'Apple_Terminal', TERM: 'xterm-256color' },
      expected: false,
    },
    {
      name: 'VS Code integrated terminal',
      env: { TERM_PROGRAM: 'vscode', TERM: 'xterm-256color' },
      expected: false,
    },
    {
      name: 'Ghostty inside tmux',
      env: { TERM_PROGRAM: 'ghostty', TERM: 'screen-256color', TMUX: '/tmp/tmux-1000/default,123,0' },
      expected: false,
    },
    {
      name: 'screen without explicit support',
      env: { TERM: 'screen-256color' },
      expected: false,
    },
  ] as const;

  for (const testCase of cases) {
    assert.equal(
      shouldUseSynchronizedOutput(testCase.env),
      testCase.expected,
      testCase.name,
    );
  }
});

test('shouldUseDisplayPalette recognizes macOS and linux terminal env matrices', () => {
  const cases = [
    {
      name: 'Ghostty on macOS',
      env: { TERM_PROGRAM: 'ghostty', TERM: 'xterm-ghostty' },
      expected: true,
    },
    {
      name: 'Apple Terminal on macOS',
      env: { TERM_PROGRAM: 'Apple_Terminal', TERM: 'xterm-256color' },
      expected: true,
    },
    {
      name: 'iTerm2 on macOS',
      env: { TERM_PROGRAM: 'iTerm.app', TERM: 'xterm-256color' },
      expected: true,
    },
    {
      name: 'WezTerm on Linux',
      env: { TERM_PROGRAM: 'WezTerm', TERM: 'wezterm' },
      expected: true,
    },
    {
      name: 'Warp on macOS',
      env: { TERM_PROGRAM: 'WarpTerminal', TERM: 'xterm-256color' },
      expected: true,
    },
    {
      name: 'Kitty on Linux',
      env: { TERM: 'xterm-kitty' },
      expected: true,
    },
    {
      name: 'Alacritty on Linux',
      env: { TERM: 'alacritty' },
      expected: true,
    },
    {
      name: 'foot on Linux',
      env: { TERM: 'foot' },
      expected: true,
    },
    {
      name: 'VS Code integrated terminal',
      env: { TERM_PROGRAM: 'vscode', TERM: 'xterm-256color' },
      expected: false,
    },
    {
      name: 'JetBrains terminal',
      env: { TERMINAL_EMULATOR: 'JetBrains-JediTerm', TERM: 'xterm-256color' },
      expected: false,
    },
    {
      name: 'tmux session',
      env: { TERM_PROGRAM: 'iTerm.app', TERM: 'screen-256color', TMUX: '/tmp/tmux-1000/default,123,0' },
      expected: false,
    },
    {
      name: 'linux console',
      env: { TERM: 'linux' },
      expected: false,
    },
    {
      name: 'dumb terminal',
      env: { TERM: 'dumb' },
      expected: false,
    },
  ] as const;

  for (const testCase of cases) {
    assert.equal(
      shouldUseDisplayPalette(testCase.env),
      testCase.expected,
      testCase.name,
    );
  }
});

test('shouldUseDisplayPalette defaults and overrides behave as expected', () => {
  assert.equal(shouldUseDisplayPalette({ TERM_PROGRAM: 'ghostty', PARSELY_DISPLAY_PALETTE: '0' }), false);
  assert.equal(shouldUseDisplayPalette({ TERM_PROGRAM: 'Apple_Terminal', PARSELY_DISPLAY_PALETTE: '1' }), true);
});

test('display palette helpers emit xterm-compatible background sequences', () => {
  assert.equal(setDefaultTerminalBackground('#FDFFF7'), '\u001B]11;#FDFFF7\u001B\\');
  assert.equal(resetDefaultTerminalBackground(), '\u001B]111\u001B\\');
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
