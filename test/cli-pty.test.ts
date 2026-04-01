import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { ENTER_ALT_SCREEN, EXIT_ALT_SCREEN } from '../src/cli-runtime.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const cliPath = fileURLToPath(new URL('../src/cli.tsx', import.meta.url));
const tsxPath = fileURLToPath(new URL('../node_modules/tsx/dist/cli.mjs', import.meta.url));

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function buildSmokeCommand(): string {
  const cliCommand = [process.execPath, tsxPath, cliPath]
    .map(shellQuote)
    .join(' ');

  // Give Ink enough time to mount in the PTY before simulating Ctrl+C as SIGINT.
  return `${cliCommand} & pid=$!; sleep 4; kill -INT "$pid" 2>/dev/null || true; wait "$pid"`;
}

function buildScriptArgs(command: string): string[] {
  if (process.platform === 'darwin') {
    return ['-q', '/dev/null', 'sh', '-lc', command];
  }

  return ['-qfc', command, '/dev/null'];
}

function canRunScript(): boolean {
  if (process.platform === 'win32') {
    return false;
  }

  const probeArgs = process.platform === 'darwin'
    ? ['-q', '/dev/null', 'sh', '-lc', 'true']
    : ['-qfc', 'true', '/dev/null'];
  const result = spawnSync('script', probeArgs, {
    stdio: ['ignore', 'ignore', 'ignore'],
  });

  return result.error == null;
}

test('cli emits alt-screen escapes and exits cleanly after SIGINT inside a pseudo terminal', { timeout: 20_000 }, async (t) => {
  if (process.stdin.isTTY !== true) {
    t.skip('PTY smoke test requires a real parent TTY');
    return;
  }

  if (!canRunScript()) {
    t.skip('script(1) is unavailable in this environment');
    return;
  }

  const child = spawn('script', buildScriptArgs(buildSmokeCommand()), {
    cwd: repoRoot,
    env: {
      ...process.env,
      PARSELY_DISPLAY_PALETTE: '0',
      PARSELY_SYNC_OUTPUT: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    output += chunk;
  });
  child.stderr.on('data', (chunk: string) => {
    output += chunk;
  });

  t.after(() => {
    if (child.exitCode == null && child.signalCode == null) {
      child.kill('SIGKILL');
    }
  });

  const closeResult = await Promise.race([
    new Promise<[number | null, NodeJS.Signals | null]>((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => resolve([code, signal]));
    }),
    delay(12_000).then(() => {
      throw new Error(`cli PTY smoke test timed out. Output: ${JSON.stringify(output)}`);
    }),
  ]);

  assert.deepEqual(closeResult, [0, null]);
  assert.equal(output.includes(ENTER_ALT_SCREEN), true);
  assert.equal(output.includes(EXIT_ALT_SCREEN), true);
});
