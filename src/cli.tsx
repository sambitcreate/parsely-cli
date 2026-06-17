#!/usr/bin/env node
import { createRequire } from 'node:module';
import { sanitizeTerminalText } from './utils/helpers.js';
import { runCli } from './cli-runtime.js';
import { AuthService } from './services/auth-service.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('-'));
const command = positional[0];
const knownCommands = new Set(['login', 'logout', 'whoami']);
const url = knownCommands.has(command ?? '') ? undefined : positional[0];

// Handle --help / -h
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
  Parsely CLI — Smart recipe scraper

  USAGE
    parsely [url]
    parsely login
    parsely logout
    parsely whoami

  ARGUMENTS
    url   Optional recipe URL to scrape immediately

  COMMANDS
    login    Store PARSELY_AUTH_TOKEN for API-backed cookbook access
    logout   Clear the stored Parsely auth session
    whoami   Show the active Parsely API session

  EXAMPLES
    parsely
    parsely https://www.simplyrecipes.com/recipes/perfect_guacamole/
    PARSELY_AUTH_TOKEN=... parsely login
    parsely whoami

  The CLI scrapes recipe data using headless Chrome with an
  AI fallback (OpenAI gpt-4o-mini). Create a .env.local file
  with OPENAI_API_KEY=your_key to enable the AI fallback.

  Authenticated cookbook features use the Parsely web API. By default
  the API base URL is https://parsely.us; set PARSELY_API_BASE_URL for
  local development.
`);
  process.exit(0);
}

// Handle --version / -v
if (args.includes('--version') || args.includes('-v')) {
  console.log(`parsely-cli v${version}`);
  process.exit(0);
}

async function main() {
  if (command === 'login') {
    const session = await AuthService.fromEnv().loginWithEnvironmentToken();
    console.log(`Stored Parsely auth session for ${session.apiBaseUrl}`);
    return;
  }

  if (command === 'logout') {
    await AuthService.fromEnv().logout();
    console.log('Cleared Parsely auth session');
    return;
  }

  if (command === 'whoami') {
    const session = await AuthService.fromEnv().currentSession();
    if (!session) {
      console.log('No Parsely auth session found');
      return;
    }

    console.log(`Parsely API: ${session.apiBaseUrl}`);
    console.log(session.expiresAt ? `Expires: ${new Date(session.expiresAt).toISOString()}` : 'Expires: unknown');
    return;
  }

  await runCli(url);
}

main().catch((error) => {
  console.error(error instanceof Error ? sanitizeTerminalText(error.message) : 'Unexpected error');
  process.exit(1);
});
