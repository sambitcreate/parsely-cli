# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.4.0] - 2026-03-31

### Added
- Nutrition facts, description, and servings fields in recipe output
- `EnvMap` type exported from terminal utils for shared use
- `AppProps` interface exported for shared use by CLI runtime
- `buildOccurrenceKeys` utility for generating display occurrence keys
- PTY smoke test for CLI (`cli-runtime` tests)
- CLI runtime lifecycle tests
- Unit tests for display quit shortcut helper
- Terminal capability coverage tests

### Changed
- `RecipeCard` layout now mirrors web layout: title-first header, nutrition sidebar, times shown as numbers
- Prep/cook/total times now displayed as plain numbers (minutes) instead of formatted strings
- AI prompt rewritten for the new `Recipe` data shape
- Consolidated redundant `q` and `esc` quit hints in `RecipeCard`
- Consolidated redundant `q` and `esc` quit hints in `Footer`
- Scraping test expectations updated for new `Recipe` data shape
- `display quit shortcut` helper used app-wide instead of inline logic
- Use shared CLI runtime entrypoint across test and app entry

### Fixed
- Light mode text visibility in URL input
- Quit shortcut copy consistency across `RecipeCard` and `Footer`

### Security
- Browser fingerprint updated for scraper evasion

## [2.3.0] - 2026-03-05

### Added
- Centralized `AppPhase` type shared across all components
- `buildOccurrenceKeys` utility for consistent key generation
- Terminal art reference files for branding consistency
- Version read dynamically from `package.json` at runtime

### Changed
- Unused `ScrapingStatus` and `Welcome` components removed
- Package contents on npm restricted to only necessary files (`dist`, `public`, `README.md`, `LICENSE`)

### Fixed
- Browser fingerprint updated to improve scraper reliability

## [2.2.0] - 2026-03-03

### Added
- App-wide theme toggle (dark/light) accessible via `Ctrl+T`
- Display palette reset support
- Expanded terminal compatibility test matrix
- Display palette enabled for Apple Terminal
- Documentation for terminal themes and compatibility

### Changed
- Recipe text sanitized for terminal output (handling special characters, box-drawing chars)

### Fixed
- `Ctrl+T` theme toggle now works correctly inside text input
- Input flow and startup resilience improved
- Browser and AI scraping fallback logic improved
- Invalid recipe URL handling

## [2.1.0] - 2026-03-02

### Added
- Scrollable compact recipe view for constrained terminal heights
- Text wrapping utility with indentation support
- Exit shortcut hint on landing screen
- Footer label for escape key updated to indicate "back" navigation
- `Ctrl+T` keyboard shortcut documentation
- Unit tests for text wrapping utility

### Changed
- Complete redesign of the parsely terminal experience
- Full-screen terminal app shell
- Scraping progress reported during the scraping phase
- Footer status text shortened for narrow terminals
- Minimal welcome copy for short terminals
- Banner made compact on small viewports
- Tighter panel vertical padding

### Fixed
- Input conflicts on short/constrained terminals
- Layout collapse on narrow viewports
- URL submission on paste + Enter (reliable submission)
- `Ctrl+C` now properly delegates to app exit handler
- Active scrapes aborted on exit
- Full-screen redraws avoided in ink
- Ghostty terminal update synchronization

### Security
- Browser recipe extraction hardened

## [2.0.0] - 2026-02-28

### Added
- Interactive TUI built with Ink (React for terminals)
- Full-screen terminal UI with scrolling recipe display
- Scraping progress indicator
- Alternate screen management in CLI entrypoint
- `PARSELY_SYNC_OUTPUT` and `PARSELY_THEME` environment variables
- README updated for npm users with publishing config

### Changed
- CLI completely rewritten from Python/Pyppeteer to TypeScript/Ink/React
- URL normalization helpers extracted for reuse
- Viewport hook changed to resize-only behavior

### Fixed
- Input conflicts on short terminals
- Reliable URL submission on paste + Enter

### Removed
- Pyppeteer dependency (replaced by `puppeteer-core`)

## [1.0.0] - 2025-07-23

### Added
- Initial `parsely-cli` release: recipe scraper with Puppeteer and OpenAI fallback
- Browser-based recipe extraction with fingerprint evasion
- OpenAI-powered recipe parsing as fallback for sites without structured data
- `OPENAI_API_KEY` environment variable configuration
- Project documentation with usage examples
