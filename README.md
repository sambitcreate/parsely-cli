# Parsely CLI

A smart recipe scraper for the terminal. It turns a recipe URL into a clean cooking brief with ingredients, timings, steps, and source metadata inside a full-screen terminal UI.

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

For AI fallback (optional but recommended), set the OpenAI API key:

```bash
export OPENAI_API_KEY="your_key_here"
```

Without this, browser scraping still works for most recipe sites.

## Terminal UI

- Uses an Ink-based full-height app shell instead of printing one-off output
- Switches into the terminal alternate screen from the CLI entrypoint and restores the previous screen on exit
- Adapts the layout to the current terminal size for wide and narrow viewports
- Collapses non-essential panels on shorter terminals so the URL field stays usable
- Shows a live scraping pipeline so browser parsing and AI fallback are visible as separate stages

## Keyboard Shortcuts

| Key      | Action            |
| -------- | ----------------- |
| `Enter`  | Submit URL        |
| `n`      | Scrape new recipe |
| `q`      | Quit              |
| `Esc`    | Quit from result view |
| `Ctrl+C` | Exit              |

## Troubleshooting

- **`Error: OpenAI API key not found`** — Set `OPENAI_API_KEY` environment variable
- **Browser scraping skipped** — Install Chrome or Chromium for better results
- **No recipe found** — AI fallback handles most sites, but results vary by site
- **Terminal looks cleared while running** — Expected; Parsely uses the alternate screen and restores your previous terminal content when it exits

## License

MIT — see [LICENSE](LICENSE).

## For Developers

### Project Structure
```
parsely-cli/
├── src/
│   ├── cli.tsx              # Entry point
│   ├── app.tsx              # Root component — app shell + state machine
│   ├── theme.ts             # Color palette
│   ├── components/          # UI components
│   ├── hooks/               # Terminal viewport and screen management
│   ├── services/scraper.ts  # Puppeteer + OpenAI
│   └── utils/helpers.ts     # Helpers
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
```

### How It Works

1. **Browser Scraping** — Headless Chrome loads the page and extracts Schema.org JSON-LD recipe data
2. **Parsing Stage** — Parsely scans and normalizes recipe schema before deciding whether the page is usable
3. **AI Fallback** — OpenAI `gpt-4o-mini` extracts data only when browser parsing cannot recover a recipe
4. **Display** — The result is plated into a responsive terminal recipe deck with pipeline, prep, and method panels

### UI Structure

- `Banner` — status-aware header with current host and app state
- `Panel` — shared bordered container used across the app shell
- `PhaseRail` — pipeline view for browser, parsing, and AI stages
- `URLInput` — normalizes pasted newlines and submits on `Enter`
- `RecipeCard` — split recipe layout with summary, ingredients, timing, and method
- `Footer` — persistent status line and key hints
- `useTerminalViewport` — terminal sizing and resize tracking

### Build & Publish

```bash
npm run build
npm publish --access public
```
