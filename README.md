# Parsely CLI

A smart recipe scraper for the terminal. Extracts structured recipe data (ingredients, instructions, cook times) from any recipe URL.

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

## Keyboard Shortcuts

| Key      | Action            |
| -------- | ----------------- |
| `Enter`  | Submit URL        |
| `n`      | Scrape new recipe |
| `q`      | Quit              |
| `Ctrl+C` | Exit              |

## Troubleshooting

- **`Error: OpenAI API key not found`** — Set `OPENAI_API_KEY` environment variable
- **Browser scraping skipped** — Install Chrome or Chromium for better results
- **No recipe found** — AI fallback handles most sites, but results vary by site

## License

MIT — see [LICENSE](LICENSE).

## For Developers

### Project Structure
```
parsely-cli/
├── src/
│   ├── cli.tsx              # Entry point
│   ├── app.tsx              # Root component — state machine
│   ├── theme.ts             # Color palette
│   ├── components/          # UI components
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

1. **Browser Scraping** — Headless Chrome extracts Schema.org JSON-LD from recipe pages
2. **AI Fallback** — OpenAI `gpt-4o-mini` extracts data when browser scraping fails
3. **Display** — Renders recipe data in a bordered card UI

### Build & Publish

```bash
npm run build
npm publish --access public
```
