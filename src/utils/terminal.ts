const SYNC_OUTPUT_START = '\u001B[?2026h';
const SYNC_OUTPUT_END = '\u001B[?2026l';
const OSC = '\u001B]';
const ST = '\u001B\\';

type EnvMap = Record<string, string | undefined>;

const DISPLAY_PALETTE_TERM_PROGRAMS = new Set([
  'ghostty',
  'Apple_Terminal',
]);

export function getRenderableHeight(rows: number): number {
  if (!Number.isFinite(rows) || rows <= 1) {
    return 1;
  }

  return Math.floor(rows) - 1;
}

export function shouldUseSynchronizedOutput(env: EnvMap = process.env): boolean {
  if (env['PARSELY_SYNC_OUTPUT'] === '0') {
    return false;
  }

  if (env['PARSELY_SYNC_OUTPUT'] === '1') {
    return true;
  }

  return env['TERM_PROGRAM'] === 'ghostty';
}

export function shouldUseDisplayPalette(env: EnvMap = process.env): boolean {
  if (env['PARSELY_DISPLAY_PALETTE'] === '0') {
    return false;
  }

  if (env['PARSELY_DISPLAY_PALETTE'] === '1') {
    return true;
  }

  return DISPLAY_PALETTE_TERM_PROGRAMS.has(env['TERM_PROGRAM'] ?? '');
}

export function setDefaultTerminalBackground(color: string): string {
  return `${OSC}11;${color}${ST}`;
}

export function resetDefaultTerminalBackground(): string {
  return `${OSC}111${ST}`;
}

function wrapChunk(chunk: Uint8Array | string): Uint8Array | string {
  if (typeof chunk === 'string') {
    return `${SYNC_OUTPUT_START}${chunk}${SYNC_OUTPUT_END}`;
  }

  return Buffer.concat([
    Buffer.from(SYNC_OUTPUT_START),
    Buffer.from(chunk),
    Buffer.from(SYNC_OUTPUT_END),
  ]);
}

export function createSynchronizedWriteProxy<T extends NodeJS.WriteStream>(stdout: T): T {
  const originalWrite = stdout.write.bind(stdout);

  return new Proxy(stdout, {
    get(target, prop) {
      if (prop !== 'write') {
        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? value.bind(target) : value;
      }

      return (
        chunk: Uint8Array | string,
        encoding?: BufferEncoding | ((error?: Error | null) => void),
        callback?: (error?: Error | null) => void,
      ) => {
        const wrappedChunk = wrapChunk(chunk);

        if (typeof encoding === 'function') {
          return originalWrite(wrappedChunk, encoding);
        }

        if (encoding) {
          return originalWrite(wrappedChunk, encoding, callback);
        }

        return originalWrite(wrappedChunk, callback);
      };
    },
  });
}
