# CLAUDE.md — AI Assistant Context for Parsely CLI

This file provides context for AI assistants (Claude, Copilot, etc.) working on this project.

## Project Overview

Parsely CLI is a terminal-based recipe scraper that extracts structured data (ingredients, instructions, cook times) from recipe URLs. It features an interactive Ink TUI with a full-height app shell, responsive panels, and alternate-screen terminal behavior.

## Tech Stack

- **Runtime:** Node.js (v18+)
- **Language:** TypeScript (ESM, `"type": "module"`)
- **TUI Framework:** [Ink](https://github.com/vadimdemedes/ink) v5 — React renderer for the terminal
- **React:** v18 with hooks (`useState`, `useCallback`, `useInput`, `useApp`)
- **Browser Automation:** [Puppeteer-core](https://pptr.dev/) — headless Chrome for scraping (auto-detects system Chrome; no bundled Chromium)
- **HTML Parsing:** [Cheerio](https://cheerio.js.org/) — jQuery-like API for extracting JSON-LD
- **AI Fallback:** [OpenAI](https://platform.openai.com/) SDK — `gpt-4o-mini` for recipe extraction
- **TypeScript Executor:** [tsx](https://github.com/privatenumber/tsx) — runs .tsx files directly

## Architecture

### State Machine

The app uses a phase-based state machine in `src/app.tsx`:

```
idle → scraping → display
                → error → idle (retry)
         display → idle (new recipe)
```

The state machine still drives the app, but the screen layout now changes per phase instead of swapping a single centered card.

### Component Tree

```
<App>
  <Banner />                    # Status-aware shell header
  {idle && <Welcome /> + <Panel><URLInput /></Panel> + <PhaseRail />}
  {scraping && <ScrapingStatus /> + <PhaseRail />}
  {display && <RecipeCard />}
  {error && <ErrorDisplay /> + <Panel><URLInput /></Panel> + <PhaseRail />}
  <Footer />                    # Persistent status + keybind hints
```

### Scraping Pipeline

1. **Puppeteer** → Launch headless Chrome → navigate → extract HTML
2. **Cheerio** → Parse HTML → find `<script type="application/ld+json">` → locate Recipe schema
3. **Parsing status** → Report a dedicated `parsing` phase back to the UI
4. **OpenAI fallback** → Send URL to `gpt-4o-mini` → parse JSON response

The browser path now uses a more browser-like Puppeteer configuration (`userAgent`, `accept-language`, and a small webdriver-masking shim) because some recipe sites return Cloudflare challenges to the default headless setup.

### Terminal Behavior

- `src/cli.tsx` enters the terminal alternate screen before rendering Ink and restores it after exit
- `useTerminalViewport()` reads live terminal width/height from Ink stdout and updates layout on resize
- `src/app.tsx` collapses non-essential panels on shorter terminals so the URL input remains visible and usable
- `src/components/URLInput.tsx` strips pasted CR/LF characters and treats `Enter` as submit even when the paste stream is messy
- `src/app.tsx` owns an `AbortController` for the active scrape so `Ctrl+C` can abort browser or AI work before exiting

### Key Files

| File | Purpose |
|------|---------|
| `src/cli.tsx` | Entry point — parses `--help`, `--version`, optional URL arg |
| `src/app.tsx` | Root component — app shell, layout switching, orchestrates phases |
| `src/theme.ts` | Color palette, symbols — single source of truth for styling |
| `src/services/scraper.ts` | All scraping logic — Puppeteer, Cheerio, OpenAI |
| `src/utils/helpers.ts` | ISO duration parser, URL validation, env config, URL host formatting |
| `src/hooks/useTerminalViewport.ts` | Terminal resize tracking |
| `src/components/Banner.tsx` | Shell header with status badge and current host |
| `src/components/Panel.tsx` | Shared bordered panel primitive |
| `src/components/PhaseRail.tsx` | Pipeline view for browser, parsing, and AI stages |
| `src/components/URLInput.tsx` | Bordered text input with validation and newline-safe submit handling |
| `src/components/RecipeCard.tsx` | Responsive recipe deck — summary, timing, ingredients, instructions |
| `src/components/ScrapingStatus.tsx` | Live status panel with animated spinner and stage messaging |
| `src/components/Footer.tsx` | Status line and dynamic keybind hints based on current phase |
| `src/components/Welcome.tsx` | Idle-phase onboarding panels |
| `src/components/ErrorDisplay.tsx` | Error recovery panel with troubleshooting guidance |
| `test/helpers.test.ts` | Input normalization and URL validation coverage |
| `test/scraper.test.ts` | Schema extraction and challenge detection coverage |

## Development Commands

```bash
npm start              # Run the CLI
npm run dev            # Run with file watching (auto-reload)
npm run typecheck      # Type-check without emitting
npm test               # Run helper and scraper unit tests
./run.sh               # Quick-start (installs deps if needed)
./run.sh <url>         # Scrape a specific URL immediately
```

## Environment Variables

- `OPENAI_API_KEY` — Required for AI fallback. Set in `.env.local` file.

## Design Decisions

- **Ink over raw ANSI** — Declarative React components are easier to maintain than imperative terminal output. Ink uses Yoga (Flexbox) for layout.
- **Phase-based state** — A simple state machine (`idle | scraping | display | error`) keeps the UI predictable.
- **Alternate screen shell** — Parsely behaves like a focused terminal app, not a command that leaves the UI in shell history. The screen switch is handled in `src/cli.tsx`, outside the React tree, to avoid corrupting Ink's render cycle.
- **Callback-driven scraping** — The scraper accepts an `onStatus` callback so the TUI can show real-time progress without polling.
- **Explicit pipeline UI** — Browser fetch, parsing, and AI fallback are surfaced as distinct stages so users can see which path produced the recipe.
- **Defensive input handling** — URL submission is handled locally in `URLInput`, with CR/LF sanitization so paste-plus-enter works reliably in real terminals.
- **Abortable scraping** — The app keeps an `AbortController` per scrape so `Ctrl+C` or unmounting does not leave Puppeteer or OpenAI requests running in the background.
- **Challenge-aware browser mode** — The browser scraper uses a browser-like fingerprint and challenge detection to avoid falling back to AI on sites that block the default headless signature.
- **Puppeteer first, AI second** — Browser scraping is more reliable and doesn't require an API key. AI is the fallback, not the default. Uses `puppeteer-core` with auto-detection of system Chrome to avoid a heavy Chromium download.
- **Theme module** — All colors are centralized in `theme.ts` for easy customization and consistency.
- **ESM throughout** — The project uses ES modules (`"type": "module"`) for compatibility with Ink v5 which is ESM-only.

## Common Patterns

### Adding a new component

1. Create `src/components/MyComponent.tsx`
2. Import theme: `import { theme } from '../theme.js';`
3. Prefer composing with `Panel` for bordered surfaces before introducing a new one-off container
4. Use Ink primitives: `<Box>`, `<Text>`, `useInput()`, `useApp()`
5. Import in `src/app.tsx` and add to the appropriate phase/layout

### Adding a new scraping strategy

1. Add the function to `src/services/scraper.ts`
2. Call it from `scrapeRecipe()` with appropriate `onStatus()` updates
3. Return a `Recipe` object with the `source` field set
4. Update `PhaseRail` if the strategy should appear as a user-visible stage

### Modifying the theme

Edit `src/theme.ts` — all components reference this module, so changes propagate everywhere. Keep colors warm and high-contrast enough for terminal rendering.

## Testing

Run tests with:

```bash
npm test
```

The current suite focuses on pure helpers rather than Ink rendering:
- `test/helpers.test.ts` covers URL normalization and pasted newline sanitization
- `test/scraper.test.ts` covers JSON-LD extraction and challenge-page detection
