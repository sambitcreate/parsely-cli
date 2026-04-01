import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { ENTER_ALT_SCREEN, EXIT_ALT_SCREEN, runCli } from '../src/cli-runtime.js';

interface MockStdout extends NodeJS.WriteStream {
  writes: string[];
}

function createMockStdout(isTTY: boolean): MockStdout {
  const writes: string[] = [];

  return {
    isTTY,
    writes,
    write(chunk: string | Uint8Array, encoding?: BufferEncoding | ((error?: Error | null) => void), callback?: (error?: Error | null) => void) {
      writes.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));

      if (typeof encoding === 'function') {
        encoding();
      } else {
        callback?.();
      }

      return true;
    },
  } as MockStdout;
}

function createRenderStub(options: {
  renderError?: Error;
  waitError?: Error;
  onRender?: (tree: React.ReactElement, renderOptions: { exitOnCtrlC: boolean; stdout: NodeJS.WriteStream }) => void;
} = {}) {
  return (tree: React.ReactElement, renderOptions: { exitOnCtrlC: boolean; stdout: NodeJS.WriteStream }) => {
    options.onRender?.(tree, renderOptions);

    if (options.renderError) {
      throw options.renderError;
    }

    return {
      waitUntilExit: async () => {
        if (options.waitError) {
          throw options.waitError;
        }
      },
    };
  };
}

test('runCli enters the alt screen for tty sessions and passes the initial url into App', async () => {
  const stdout = createMockStdout(true);
  let renderTree: React.ReactElement | undefined;
  let renderOptions: { exitOnCtrlC: boolean; stdout: NodeJS.WriteStream } | undefined;

  await runCli('https://example.com/recipe', {
    stdout,
    shouldUseDisplayPalette: () => false,
    shouldUseSynchronizedOutput: () => false,
    renderApp: createRenderStub({
      onRender(tree, options) {
        renderTree = tree;
        renderOptions = options;
      },
    }),
  });

  assert.deepEqual(stdout.writes, [ENTER_ALT_SCREEN, EXIT_ALT_SCREEN]);
  assert.equal(renderTree?.props.initialUrl, 'https://example.com/recipe');
  assert.equal(renderOptions?.exitOnCtrlC, false);
  assert.equal(renderOptions?.stdout, stdout);
});

test('runCli skips alt screen writes for non-tty sessions', async () => {
  const stdout = createMockStdout(false);
  let renderOptions: { exitOnCtrlC: boolean; stdout: NodeJS.WriteStream } | undefined;

  await runCli(undefined, {
    stdout,
    shouldUseDisplayPalette: () => true,
    shouldUseSynchronizedOutput: () => true,
    renderApp: createRenderStub({
      onRender(_tree, options) {
        renderOptions = options;
      },
    }),
  });

  assert.deepEqual(stdout.writes, []);
  assert.equal(renderOptions?.stdout, stdout);
});

test('runCli passes a synchronized stdout proxy to Ink when sync output is enabled', async () => {
  const stdout = createMockStdout(true);
  const wrappedStdout = createMockStdout(true);
  let renderStdout: NodeJS.WriteStream | undefined;

  await runCli(undefined, {
    stdout,
    shouldUseDisplayPalette: () => false,
    shouldUseSynchronizedOutput: () => true,
    createSynchronizedWriteProxy: () => wrappedStdout,
    renderApp: createRenderStub({
      onRender(_tree, options) {
        renderStdout = options.stdout;
      },
    }),
  });

  assert.equal(renderStdout, wrappedStdout);
  assert.deepEqual(stdout.writes, [ENTER_ALT_SCREEN, EXIT_ALT_SCREEN]);
});

test('runCli resets the palette before and after leaving the alt screen when enabled', async () => {
  const stdout = createMockStdout(true);

  await runCli(undefined, {
    stdout,
    shouldUseDisplayPalette: () => true,
    shouldUseSynchronizedOutput: () => false,
    resetDefaultTerminalBackground: () => '<reset>',
    renderApp: createRenderStub(),
  });

  assert.deepEqual(stdout.writes, [
    ENTER_ALT_SCREEN,
    '<reset>',
    EXIT_ALT_SCREEN,
    '<reset>',
  ]);
});

test('runCli still resets the palette when Ink rejects during shutdown', async () => {
  const stdout = createMockStdout(true);

  await assert.rejects(
    runCli(undefined, {
      stdout,
      shouldUseDisplayPalette: () => true,
      shouldUseSynchronizedOutput: () => false,
      resetDefaultTerminalBackground: () => '<reset>',
      renderApp: createRenderStub({ waitError: new Error('wait failed') }),
    }),
    /wait failed/,
  );

  assert.deepEqual(stdout.writes, [
    ENTER_ALT_SCREEN,
    '<reset>',
    EXIT_ALT_SCREEN,
    '<reset>',
  ]);
});

test('runCli still resets the palette when render throws before Ink can mount', async () => {
  const stdout = createMockStdout(true);

  await assert.rejects(
    runCli(undefined, {
      stdout,
      shouldUseDisplayPalette: () => true,
      shouldUseSynchronizedOutput: () => false,
      resetDefaultTerminalBackground: () => '<reset>',
      renderApp: createRenderStub({ renderError: new Error('render failed') }),
    }),
    /render failed/,
  );

  assert.deepEqual(stdout.writes, [
    ENTER_ALT_SCREEN,
    '<reset>',
    EXIT_ALT_SCREEN,
    '<reset>',
  ]);
});
