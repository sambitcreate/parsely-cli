#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './app.js';

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

render(<App initialUrl={url} />);
