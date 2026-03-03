const SYNC_OUTPUT_START = '\u001B[?2026h';
const SYNC_OUTPUT_END = '\u001B[?2026l';
const OSC = '\u001B]';
const ST = '\u001B\\';

type EnvMap = Record<string, string | undefined>;

const SYNCHRONIZED_OUTPUT_TERM_PROGRAMS = new Set([
  'ghostty',
  'WezTerm',
]);

const SYNCHRONIZED_OUTPUT_TERMS = [
  'xterm-kitty',
  'xterm-ghostty',
];

const DISPLAY_PALETTE_TERM_PROGRAMS = new Set([
  'ghostty',
  'Apple_Terminal',
  'iTerm.app',
  'WezTerm',
  'WarpTerminal',
]);

const DISPLAY_PALETTE_TERMS = [
  'alacritty',
  'foot',
  'foot-extra',
  'xterm-ghostty',
  'xterm-kitty',
];

function getTerm(env: EnvMap): string {
  return env['TERM']?.toLowerCase() ?? '';
}

function isMultiplexer(env: EnvMap): boolean {
  const term = getTerm(env);
  return Boolean(env['TMUX'] || env['STY'] || term.startsWith('screen') || term.startsWith('tmux'));
}

function isPaletteBlocked(env: EnvMap): boolean {
  const term = getTerm(env);
  return term === 'dumb' || term === 'linux' || env['TERM_PROGRAM'] === 'vscode' || env['TERMINAL_EMULATOR'] === 'JetBrains-JediTerm' || isMultiplexer(env);
}

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

  if (isMultiplexer(env)) {
    return false;
  }

  const termProgram = env['TERM_PROGRAM'] ?? '';
  if (SYNCHRONIZED_OUTPUT_TERM_PROGRAMS.has(termProgram)) {
    return true;
  }

  const term = getTerm(env);
  return SYNCHRONIZED_OUTPUT_TERMS.some((candidate) => term.startsWith(candidate));
}

export function shouldUseDisplayPalette(env: EnvMap = process.env): boolean {
  if (env['PARSELY_DISPLAY_PALETTE'] === '0') {
    return false;
  }

  if (env['PARSELY_DISPLAY_PALETTE'] === '1') {
    return true;
  }

  if (isPaletteBlocked(env)) {
    return false;
  }

  const termProgram = env['TERM_PROGRAM'] ?? '';
  if (DISPLAY_PALETTE_TERM_PROGRAMS.has(termProgram)) {
    return true;
  }

  const term = getTerm(env);
  return DISPLAY_PALETTE_TERMS.some((candidate) => term.startsWith(candidate));
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
