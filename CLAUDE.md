# CLAUDE.md — AI Assistant Context for Parsely CLI

This file provides context for AI assistants (Claude, Copilot, etc.) working on this project.

## Project Overview

Parsely CLI is a terminal-based recipe scraper that extracts structured data (ingredients, instructions, cook times) from recipe URLs. It features an interactive TUI built with Ink (React for CLIs).

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

### Component Tree

```
<App>
  <Banner />                    # ASCII art header
  {idle && <Welcome /> + <URLInput />}
  {scraping && <ScrapingStatus />}
  {display && <RecipeCard /> + success message}
  {error && <ErrorDisplay /> + <URLInput />}
  <Footer />                    # Context-aware keybind hints
```

### Scraping Pipeline

1. **Puppeteer** → Launch headless Chrome → navigate → extract HTML
2. **Cheerio** → Parse HTML → find `<script type="application/ld+json">` → locate Recipe schema
3. **OpenAI fallback** → Send URL to `gpt-4o-mini` → parse JSON response

### Key Files

| File | Purpose |
|------|---------|
| `src/cli.tsx` | Entry point — parses `--help`, `--version`, optional URL arg |
| `src/app.tsx` | Root component — state machine, orchestrates phases |
| `src/theme.ts` | Color palette, symbols — single source of truth for styling |
| `src/services/scraper.ts` | All scraping logic — Puppeteer, Cheerio, OpenAI |
| `src/utils/helpers.ts` | ISO duration parser, URL validation, env config |
| `src/components/Banner.tsx` | ASCII art logo |
| `src/components/URLInput.tsx` | Bordered text input with validation |
| `src/components/RecipeCard.tsx` | Recipe display card — times, ingredients, instructions |
| `src/components/ScrapingStatus.tsx` | Animated spinner with phase messages |
| `src/components/Footer.tsx` | Dynamic keybind hints based on current phase |
| `src/components/Welcome.tsx` | Welcome text shown on first load |
| `src/components/ErrorDisplay.tsx` | Error panel with guidance |

## Development Commands

```bash
npm start              # Run the CLI
npm run dev            # Run with file watching (auto-reload)
npm run typecheck      # Type-check without emitting
./run.sh               # Quick-start (installs deps if needed)
./run.sh <url>         # Scrape a specific URL immediately
```

## Environment Variables

- `OPENAI_API_KEY` — Required for AI fallback. Set in `.env.local` file.

## Design Decisions

- **Ink over raw ANSI** — Declarative React components are easier to maintain than imperative terminal output. Ink uses Yoga (Flexbox) for layout.
- **Phase-based state** — A simple state machine (`idle | scraping | display | error`) keeps the UI predictable.
- **Callback-driven scraping** — The scraper accepts an `onStatus` callback so the TUI can show real-time progress without polling.
- **Puppeteer first, AI second** — Browser scraping is more reliable and doesn't require an API key. AI is the fallback, not the default. Uses `puppeteer-core` with auto-detection of system Chrome to avoid a heavy Chromium download.
- **Theme module** — All colors are centralized in `theme.ts` for easy customization and consistency.
- **ESM throughout** — The project uses ES modules (`"type": "module"`) for compatibility with Ink v5 which is ESM-only.

## Common Patterns

### Adding a new component

1. Create `src/components/MyComponent.tsx`
2. Import theme: `import { theme } from '../theme.js';`
3. Use Ink primitives: `<Box>`, `<Text>`, `useInput()`, `useApp()`
4. Import in `src/app.tsx` and add to the appropriate phase

### Adding a new scraping strategy

1. Add the function to `src/services/scraper.ts`
2. Call it from `scrapeRecipe()` with appropriate `onStatus()` updates
3. Return a `Recipe` object with the `source` field set

### Modifying the theme

Edit `src/theme.ts` — all components reference this module, so changes propagate everywhere.

## Testing

No test suite is currently configured. To add tests, consider:
- [ink-testing-library](https://github.com/vadimdemedes/ink-testing-library) for component tests
- Vitest or Jest for unit tests on `helpers.ts` and `scraper.ts`
