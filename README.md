# Parsely CLI

A smart recipe scraper for the terminal. It turns a recipe URL into a clean cooking brief with ingredients, timings, steps, and source metadata inside a viewport-filling terminal UI.

## Installation

### npm
```bash
npm install -g @sambitcreate/parsely-cli
```

### Homebrew
```bash
brew tap sambitcreate/tap
brew install parsely
```

## Usage

```bash
parsely
parsely https://www.simplyrecipes.com/recipes/perfect_guacamole/
parsely --help
parsely --version
```

## Configuration

For AI fallback (optional but recommended), set the OpenAI API key in your shell:

```bash
export OPENAI_API_KEY="your_key_here"
parsely https://example.com/recipe
```

Without a key, browser scraping still works for most recipe sites.

### Recommended: inject keys from a secret manager

Parsely never persists the API key — it reads `OPENAI_API_KEY` from the environment at startup. Prefer injecting it at invocation time from a secret manager so the key never lands on disk in a flat file:

```bash
# 1Password CLI
OPENAI_API_KEY=$(op read "op://Personal/OpenAI/api_key") parsely <url>

# pass
OPENAI_API_KEY=$(pass show openai/api_key) parsely <url>

# macOS Keychain
OPENAI_API_KEY=$(security find-generic-password -a "$USER" -s openai_api_key -w) parsely <url>
```

### `.env.local` (discouraged)

For quick local development Parsely will read `.env.local` if it exists. This file is `.gitignore`d, but it is still exposed to any process with filesystem access and to backup/sync tools (Time Machine, iCloud Drive, Dropbox). If you must use it:

1. Treat the key as already-leaked — rotate it regularly at [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
2. Consider installing a secret scanner like [`gitleaks`](https://github.com/gitleaks/gitleaks) or [`detect-secrets`](https://github.com/Yelp/detect-secrets) as a pre-commit hook so `.env*` files can never be staged.
3. Delete the file when you're done with a development session.

Optional terminal tuning:

```bash
export PARSELY_SYNC_OUTPUT=1   # force synchronized output on
export PARSELY_SYNC_OUTPUT=0   # force synchronized output off
export PARSELY_DISPLAY_PALETTE=1   # force terminal background palette on
export PARSELY_DISPLAY_PALETTE=0   # force terminal background palette off
export PARSELY_THEME=dark      # start in dark theme
export PARSELY_THEME=light     # start in light theme
```

## Terminal UI

- Uses dedicated full-screen Ink views for the idle, scraping, display, and error phases instead of a general shell layout
- `src/cli-runtime.ts` switches into the terminal alternate screen before Ink mounts and restores the previous screen on exit
- Restores the terminal's default background color on exit after using the app palette
- Reserves one terminal row so Ink can update incrementally instead of clearing the whole screen on every spinner tick
- Adapts the layout to the current terminal size for wide and narrow viewports
- Collapses non-essential panels on shorter terminals so the URL field stays usable
- Cancels in-flight browser and AI scraping when you press `Ctrl+C`
- Shows a live scraping pipeline so browser parsing and AI fallback are visible as separate stages
- Detects light/dark preference on startup and applies a matching app-wide theme
- Lets you toggle the full app theme at runtime with `Ctrl+T`
- Enables synchronized output in Ghostty, WezTerm, and Kitty-compatible terminals by default so frame updates paint atomically
- Applies the terminal background palette from the app root when the current terminal is in the supported compatibility set
- Avoids advanced palette/sync behavior in `tmux`, `screen`, VS Code's integrated terminal, JetBrains terminals, the Linux console, and `TERM=dumb` unless you explicitly override it

## Keyboard Shortcuts

| Key | When active | Action |
| --- | ----------- | ------ |
| `Enter` | Idle, error | Submit the current URL |
| `Ctrl+T` | Idle, scraping, display, error | Toggle theme |
| `n` | Display | Start a new scrape from the idle screen |
| `q` | Display | Quit |
| `Esc` | Display | Quit |
| `Ctrl+C` | Any phase | Abort any active scrape and exit |

## Troubleshooting

- **`Error: OpenAI API key not found`** — Set `OPENAI_API_KEY` environment variable
- **Browser scraping skipped** — Install Chrome or Chromium for better results
- **No recipe found** — AI fallback handles most sites, but results vary by site
- **Terminal looks cleared while running** — Expected; Parsely uses the alternate screen and restores your previous terminal content when it exits
- **Background color does not change** — Your terminal may be outside the built-in compatibility list or behind a multiplexer. Use `PARSELY_DISPLAY_PALETTE=1` to force palette updates on, or `PARSELY_DISPLAY_PALETTE=0` to disable them entirely
- **Theme starts in the wrong mode** — Set `PARSELY_THEME=dark` or `PARSELY_THEME=light` to override automatic detection
- **Ghostty or WezTerm still flickers** — Parsely enables synchronized output automatically there; set `PARSELY_SYNC_OUTPUT=1` to force it on elsewhere or `PARSELY_SYNC_OUTPUT=0` to disable it
- **Some sites challenge headless browsers** — Parsely now uses a more browser-like Puppeteer setup, but challenge pages can still force an AI fallback

## License

MIT — see [LICENSE](LICENSE).

## For Developers

### Project Structure
```
parsely-cli/
├── src/
│   ├── cli.tsx              # Thin CLI entrypoint: args/help/version
│   ├── cli-runtime.ts       # Terminal runtime: alt-screen, stdout wrapping, cleanup
│   ├── app.tsx              # Root component — phase screens + state machine
│   ├── theme.ts             # Color palette
│   ├── components/          # UI components
│   ├── hooks/               # Terminal viewport and screen management
│   ├── services/scraper.ts  # Puppeteer + OpenAI
│   └── utils/               # Input, URL, and terminal helpers
├── test/                    # Runtime, PTY, shortcuts, text layout, helpers, and scraper tests
├── package.json
├── tsconfig.json
└── CLAUDE.md                # AI assistant context
```

### Development Setup

```bash
git clone https://github.com/sambitcreate/parsely-cli.git
cd parsely-cli
npm install
npm run dev
npm test
```

### How It Works

1. **Browser Scraping** — Headless Chrome loads the page and extracts Schema.org JSON-LD recipe data
2. **Parsing Stage** — Parsely scans and normalizes recipe schema before deciding whether the page is usable
3. **AI Fallback** — OpenAI `gpt-4o-mini` extracts data only when browser parsing cannot recover a recipe
4. **Phase Transitions** — `src/app.tsx` moves `idle -> scraping -> display`, or `idle/scraping -> error -> scraping` when the retry form submits another URL
5. **Display** — The result is plated into a responsive terminal recipe deck with pipeline, prep, and method panels

### UI Structure

- `LandingScreen` — centered logo and input for the idle state
- `LoadingScreen` — minimal centered status view during scraping
- `Banner` — status-aware header with current host and app state
- `Panel` — shared bordered container used across the error shell
- `PhaseRail` — pipeline view for browser, parsing, and AI stages
- `URLInput` — normalizes pasted newlines and exposes phase-appropriate shortcut hints under the field
- `RecipeCard` — split recipe layout with summary, ingredients, timing, and method
- `Footer` — persistent status line and key hints on non-landing screens
- `cli-runtime.ts` — owns alternate-screen entry/exit, synchronized stdout proxying, and terminal cleanup outside the React tree
- `useTerminalViewport` — terminal sizing and resize tracking
- `utils/terminal.ts` — terminal compatibility detection, synchronized-output, palette control, and render-height helpers

### Tests

```bash
npm test
```

The test suite covers runtime cleanup in `test/cli-runtime.test.ts`, PTY alt-screen behavior in `test/cli-pty.test.ts`, shortcut handling in `test/shortcuts.test.ts`, text wrapping in `test/text-layout.test.ts`, plus input normalization, schema extraction, theme-mode helpers, and terminal compatibility detection.

### Build & Publish

```bash
npm run build
npm publish --access public
```
