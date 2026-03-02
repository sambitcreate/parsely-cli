# AGENTS.md

Context for coding agents working in `parsely-cli`.

## Overview

Parsely CLI is a full-screen terminal recipe scraper built with Ink. The app takes a recipe URL, tries to recover structured recipe data from the page, and renders the result as a plated terminal view with ingredients, timings, and instructions.

The runtime flow is:

1. `src/cli.tsx` parses CLI args, enters the alternate screen, and mounts Ink.
2. `src/app.tsx` runs a phase-based UI state machine: `idle -> scraping -> display` or `error`.
3. `src/services/scraper.ts` attempts browser/schema extraction first, then falls back to OpenAI only when needed.
4. The display phase renders a dedicated recipe layout in `src/components/RecipeCard.tsx`.

## Stack

- Node.js 18+
- TypeScript with ESM (`"type": "module"`)
- React 18
- Ink v5 for terminal rendering
- `ink-text-input` for URL entry
- `ink-spinner` for scrape status
- `puppeteer-core` for browser extraction
- `cheerio` for schema parsing
- OpenAI SDK for fallback extraction
- `cfonts` and `ink-big-text` for terminal wordmark/large display text

## Current UI Model

### Idle

- `src/components/LandingScreen.tsx`
- Minimal landing view on the paper background (`#FDFFF7`)
- Uses a single fixed Parsely block wordmark
- Centers the logo and URL input as a single measured block

### Scraping

- `src/components/LoadingScreen.tsx`
- Shows only a centered loading indicator between the landing screen and the recipe page

### Display

- `src/components/RecipeCard.tsx`
- Dedicated recipe screen instead of the general app shell
- Uses Parsely green palette and paper background

### Error

- `src/components/ErrorDisplay.tsx`
- Retry path routes back through `URLInput`

## Terminal Behavior

- The CLI uses the terminal alternate screen while Parsely is open.
- `src/utils/terminal.ts` deliberately leaves one row free so Ink stays on incremental rendering and does not clear the whole viewport on every update.
- Ghostty synchronized output is enabled by default through the CLI/stdout wrapper.
- `src/hooks/useDisplayPalette.ts` sets the terminal background color during the landing and recipe display screens.
- `Ctrl+C` should abort any in-flight scrape before exit.

Do not move alternate-screen control into the React tree. It belongs in `src/cli.tsx`.

## Scraping Pipeline

Primary path:

1. Launch system Chrome/Chromium via Puppeteer
2. Load the page and recover HTML
3. Parse `application/ld+json` blocks with Cheerio
4. Extract a `Recipe` schema when available

Fallback path:

1. Detect that browser/schema extraction was insufficient
2. Call OpenAI `gpt-4o-mini`
3. Normalize the result into the shared `Recipe` shape

The app is intentionally browser-first. Do not make AI the default path.

## Files That Matter

- `src/cli.tsx`: CLI entrypoint, alternate screen, stdout wrapping
- `src/app.tsx`: state machine, input flow, scrape orchestration
- `src/services/scraper.ts`: browser extraction, schema parsing, AI fallback
- `src/components/LandingScreen.tsx`: idle/landing view
- `src/components/URLInput.tsx`: paste-safe single-line URL input
- `src/components/RecipeCard.tsx`: recipe presentation
- `src/utils/helpers.ts`: URL normalization and input sanitization
- `src/utils/terminal.ts`: render-height, synchronized output, background helpers
- `src/theme.ts`: shared color palette and symbols

## Development Commands

```bash
npm install
npm start
npm run dev
npm run typecheck
npm test
npm run build
```

## Working Rules

- Prefer `rg` for search.
- Use `apply_patch` for file edits.
- Keep the terminal UI minimal; avoid reintroducing clutter on the landing screen.
- Preserve the paper background and Parsely green branding in the landing and recipe display screens.
- Keep layout responsive to narrow and short terminals.
- Avoid changes that reintroduce full-screen redraw flicker.
- If you change terminal rendering behavior, verify in a real TTY, not only with static reads.

## Testing Expectations

Before finishing UI or scraper changes, run:

```bash
npm run typecheck
npm test
npm run build
```

If the work touches React layout or terminal rendering, also run:

```bash
npx -y react-doctor@latest . --verbose --diff
```

## Existing Docs

- `README.md` already exists and covers install, usage, and developer setup.
- `CLAUDE.md` contains broader assistant-oriented project notes, but may lag behind the newest UI changes.
