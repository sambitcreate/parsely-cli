#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './app.js';
import { sanitizeTerminalText } from './utils/helpers.js';
import {
  createSynchronizedWriteProxy,
  resetDefaultTerminalBackground,
  shouldUseDisplayPalette,
  shouldUseSynchronizedOutput,
} from './utils/terminal.js';

const ENTER_ALT_SCREEN = '\u001B[?1049h\u001B[2J\u001B[H';
const EXIT_ALT_SCREEN = '\u001B[?1049l';

// Simple arg parsing – accept an optional recipe URL as the first positional arg
const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('-'));

// Handle --help / -h
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
  Parsely CLI — Smart recipe scraper

  USAGE
    parsely [url]

  ARGUMENTS
    url   Optional recipe URL to scrape immediately

  EXAMPLES
    parsely
    parsely https://www.simplyrecipes.com/recipes/perfect_guacamole/

  The CLI scrapes recipe data using headless Chrome with an
  AI fallback (OpenAI gpt-4o-mini). Create a .env.local file
  with OPENAI_API_KEY=your_key to enable the AI fallback.
`);
  process.exit(0);
}

// Handle --version / -v
if (args.includes('--version') || args.includes('-v')) {
  console.log('parsely-cli v2.0.0');
  process.exit(0);
}

async function main() {
  const useAltScreen = process.stdout.isTTY;
  const inkStdout = useAltScreen && shouldUseSynchronizedOutput()
    ? createSynchronizedWriteProxy(process.stdout)
    : process.stdout;

  if (useAltScreen) {
    process.stdout.write(ENTER_ALT_SCREEN);
  }

  try {
    const instance = render(<App initialUrl={url} />, {
      exitOnCtrlC: false,
      stdout: inkStdout,
    });
    await instance.waitUntilExit();
  } finally {
    if (useAltScreen && shouldUseDisplayPalette()) {
      process.stdout.write(resetDefaultTerminalBackground());
    }

    if (useAltScreen) {
      process.stdout.write(EXIT_ALT_SCREEN);
    }

    if (useAltScreen && shouldUseDisplayPalette()) {
      process.stdout.write(resetDefaultTerminalBackground());
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? sanitizeTerminalText(error.message) : 'Unexpected error');
  process.exit(1);
});
