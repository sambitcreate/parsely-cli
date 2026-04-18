# AGENTS.md

Context for coding agents working in `parsely-cli`.

## Overview

Parsely CLI is a full-screen terminal recipe scraper built with Ink. The app takes a recipe URL, tries to recover structured recipe data from the page, and renders the result as a plated terminal view with ingredients, timings, and instructions.

The runtime flow is:

1. `src/cli.tsx` parses CLI args/help/version and hands control to `src/cli-runtime.ts`.
2. `src/cli-runtime.ts` owns the alternate screen, synchronized stdout proxying, Ink mounting, and terminal cleanup.
3. `src/app.tsx` runs a phase-based UI state machine: `idle -> scraping -> display`, `idle/scraping -> error`, and retry submit from the error screen back into `scraping`.
4. The UI swaps between dedicated phase screens instead of keeping a single general shell mounted across the whole flow.
5. `src/services/scraper.ts` attempts browser/schema extraction first, then falls back to OpenAI only when needed.
6. The display phase renders a dedicated recipe layout in `src/components/RecipeCard.tsx`.

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
- Retry is its own error-phase layout: `ErrorDisplay` + retry `URLInput` + `PhaseRail` + `Footer`
- Submitting the retry field transitions the app back into `scraping`; there is no direct `error -> idle` jump unless the user exits

## Terminal Behavior

- The CLI uses the terminal alternate screen while Parsely is open.
- `src/cli-runtime.ts` owns alternate-screen entry/exit, stdout wrapping, and shutdown cleanup. Keep that behavior out of `src/cli.tsx` and out of the React tree.
- `src/utils/terminal.ts` deliberately leaves one row free so Ink stays on incremental rendering and does not clear the whole viewport on every update.
- Synchronized output defaults on only for Ghostty, WezTerm, and Kitty-compatible terminals unless `PARSELY_SYNC_OUTPUT` overrides it.
- `src/hooks/useDisplayPalette.ts` applies the active app background from the root `App` tree when palette support is enabled, and runtime cleanup resets the terminal default background on exit.
- `Ctrl+C` should abort any in-flight scrape before exit.

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

- `src/cli.tsx`: thin CLI entrypoint for args/help/version
- `src/cli-runtime.ts`: terminal runtime, alt-screen lifecycle, synchronized stdout wrapping, cleanup
- `src/app.tsx`: state machine, input flow, scrape orchestration
- `src/services/scraper.ts`: browser extraction, schema parsing, AI fallback
- `src/components/LandingScreen.tsx`: idle/landing view
- `src/components/URLInput.tsx`: paste-safe single-line URL input
- `src/components/RecipeCard.tsx`: recipe presentation
- `src/utils/helpers.ts`: URL normalization and input sanitization
- `src/utils/shortcuts.ts`: phase-aware keyboard shortcut helpers
- `src/utils/text-layout.ts`: wrapping helpers for titles and instructions
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

The current docs and tests should stay aligned on coverage for:

- CLI runtime teardown in `test/cli-runtime.test.ts`
- PTY alt-screen smoke coverage in `test/cli-pty.test.ts`
- Shortcut helpers in `test/shortcuts.test.ts`
- Text layout helpers in `test/text-layout.test.ts`

## Existing Docs

- `README.md` already exists and covers install, usage, and developer setup.
- `README.md` should describe phase-aware shortcuts, `src/cli-runtime.ts`, and the dedicated idle/scraping/display/error screens.
- `CLAUDE.md` contains broader assistant-oriented project notes and should stay aligned with the current runtime/test structure.
