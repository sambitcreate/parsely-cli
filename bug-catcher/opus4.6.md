All three reviews are complete. Here's the consolidated report:

  ---
  Parsely CLI — Full Codebase Review

  SECURITY (17 findings)

  Critical

  ┌─────┬───────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │  #  │         File          │                                                         Issue                                                          │
  ├─────┼───────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ S1  │ .env.local            │ Live OpenAI API key in plaintext — the sk-proj-... key appears to be a real production key. Rotate it immediately at   │
  │     │                       │ https://platform.openai.com/api-keys                                                                                   │
  ├─────┼───────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ S2  │ scraper.ts:268,       │ URL scheme not validated before Puppeteer goto() — CLI args bypass normalizeRecipeUrl, so parsely file:///etc/passwd   │
  │     │ cli.tsx:12            │ or parsely javascript:void(0) reach Puppeteer directly                                                                 │
  └─────┴───────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  High

  ┌─────┬────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │  #  │        File        │                                                           Issue                                                            │
  ├─────┼────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ S3  │ scraper.ts:30-34   │ --no-sandbox disables Chromium sandbox — a malicious page exploit gets full system access                                  │
  ├─────┼────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ S4  │ RecipeCard.tsx     │ No ANSI escape sanitization — scraped recipe data rendered raw in terminal; a malicious JSON-LD could inject OSC sequences │
  │     │                    │  (change terminal title, clipboard, hide text)                                                                             │
  ├─────┼────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ S5  │ scraper.ts:328-332 │ AI response spread without validation — {...recipe} spreads arbitrary AI-generated fields into the Recipe object with no   │
  │     │                    │ schema check                                                                                                               │
  ├─────┼────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ S6  │ scraper.ts:289-297 │ Silent catch swallows all browser errors — Chrome crashes, SSL failures, and security errors are invisible; user only sees │
  │     │                    │  silent AI fallback                                                                                                        │
  └─────┴────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  Medium

  ┌─────┬──────────────────────────┬─────────────────────────────────────────────────────────────────────────────────────────────────┐
  │  #  │           File           │                                              Issue                                              │
  ├─────┼──────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ S7  │ scraper.ts (6 locations) │ Empty catch blocks suppress errors throughout the scraper                                       │
  ├─────┼──────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ S8  │ scraper.ts:202           │ execSync for Chrome detection — synchronous, no timeout, stderr suppressed                      │
  ├─────┼──────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ S9  │ helpers.ts:53            │ SSRF potential — internal network addresses (localhost, 169.254.169.254) accepted as valid URLs │
  ├─────┼──────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ S10 │ scraper.ts:268-283       │ No response size limit on Puppeteer navigation; malicious page could exhaust memory             │
  ├─────┼──────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ S11 │ scraper.ts:48-85         │ findRecipeJson candidate array grows unbounded from nested @graph — DoS vector                  │
  ├─────┼──────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ S12 │ terminal.ts:40-42        │ setDefaultTerminalBackground interpolates color param into OSC sequence without validation      │
  ├─────┼──────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ S13 │ scraper.ts:331           │ Prototype-adjacent risk from spreading unvalidated AI response                                  │
  ├─────┼──────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ S14 │ cli.tsx:11-12            │ CLI argument not validated before reaching App component                                        │
  └─────┴──────────────────────────┴─────────────────────────────────────────────────────────────────────────────────────────────────┘

  ---
  BUGS (10 findings)

  Critical

  ┌─────┬────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │  #  │        File        │                                                           Issue                                                            │
  ├─────┼────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ B1  │ cli.tsx:38         │ Version mismatch — --version prints v2.0.0 but package.json says 2.1.0                                                     │
  ├─────┼────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ B2  │ scraper.ts:244-300 │ Browser double-close race — if abort fires during await browser.close(), onAbort handler tries to close the same instance  │
  │     │                    │ concurrently                                                                                                               │
  ├─────┼────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ B3  │ app.tsx:95-105     │ useInput active in all phases — isActive covers `idle                                                                      │
  └─────┴────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  High

  ┌─────┬────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │  #  │        File        │                                                           Issue                                                            │
  ├─────┼────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ B4  │ scraper.ts:331-332 │ AI recipe not normalized — if AI returns recipeIngredient as non-array, downstream .map() crashes                          │
  ├─────┼────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ B5  │ app.tsx:83-87      │ handleScrape stale closure — initial scrape effect has [] deps; React strict mode would double-fire, launching two         │
  │     │                    │ concurrent scrapes                                                                                                         │
  └─────┴────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  Medium

  ┌─────┬─────────────────────────┬─────────────────────────────────────────────────────────────────────────────────────────────┐
  │  #  │          File           │                                            Issue                                            │
  ├─────┼─────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤
  │ B6  │ RecipeCard.tsx:405-413  │ BigText uses key={line} — duplicate title lines would cause React key collision             │
  ├─────┼─────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤
  │ B7  │ Footer.tsx:52-57        │ Compact status uses .replace() chain on full sentences — silently breaks if wording changes │
  ├─────┼─────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤
  │ B8  │ helpers.ts:11-14        │ ISO 8601 regex accepts bare P and PT as valid (returns 0 instead of -1)                     │
  ├─────┼─────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤
  │ B9  │ LandingScreen.tsx:21-23 │ SVG file read at module load — crashes entire app with ENOENT if file path resolves wrong   │
  ├─────┼─────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤
  │ B10 │ text-layout.ts:1-3      │ getWidth counts codepoints, not terminal columns — CJK/emoji text overflows                 │
  └─────┴─────────────────────────┴─────────────────────────────────────────────────────────────────────────────────────────────┘

  ---
  SIMPLIFICATION (20 findings)

  High Impact

  ┌─────┬────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │  #  │        File        │                                                           Issue                                                            │
  ├─────┼────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ C1  │ ScrapingStatus.tsx │ Dead code — entire component unused (app uses LoadingScreen instead). Delete the file                                      │
  ├─────┼────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ C2  │ Welcome.tsx        │ Dead code — entire component unused (app uses LandingScreen instead). Delete the file                                      │
  ├─────┼────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ C3  │ RecipeCard.tsx     │ 530-line mega-component — contains 12 functions and two complete rendering paths; split into CompactRecipeView,            │
  │     │                    │ FullRecipeView, and shared helpers                                                                                         │
  ├─────┼────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ C4  │ cli.tsx:38         │ Version string hardcoded v2.0.0 — read from package.json dynamically                                                       │
  └─────┴────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  Medium Impact

  ┌─────┬────────────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │  #  │                File                │                                                   Issue                                                   │
  ├─────┼────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ C5  │ Banner.tsx, PhaseRail.tsx,         │ AppPhase type duplicated 3 times — extract to shared types.ts                                             │
  │     │ Footer.tsx                         │                                                                                                           │
  ├─────┼────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ C6  │ RecipeCard.tsx, LandingScreen.tsx  │ buildOccurrenceKeys duplicated — extract to shared utility                                                │
  ├─────┼────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ C7  │ Footer.tsx:52-57                   │ Brittle .replace() chain — make getStatusCopy accept compact boolean                                      │
  ├─────┼────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ C8  │ RecipeCard.tsx:348-356             │ 4-level nested ternary (violates project guidelines) — extract to helper function                         │
  ├─────┼────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ C9  │ scraper.ts:220                     │ Awaited<ReturnType<Awaited<ReturnType<typeof puppeteer.launch>>['newPage']>> — just import Page from      │
  │     │                                    │ puppeteer-core                                                                                            │
  ├─────┼────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ C10 │ RecipeCard.tsx:246-261             │ Compact layout computed unconditionally even when not constrained                                         │
  └─────┴────────────────────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  Low Impact

  ┌─────┬────────────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────┐
  │  #  │          File          │                                            Issue                                             │
  ├─────┼────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────┤
  │ C11 │ app.tsx:2              │ Unused Text import                                                                           │
  ├─────┼────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────┤
  │ C12 │ app.tsx:105            │ isActive guard covers all phases — always true, remove it                                    │
  ├─────┼────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────┤
  │ C13 │ RecipeCard.tsx:348-357 │ Same regex computed twice for color and bold — compute once                                  │
  ├─────┼────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────┤
  │ C14 │ helpers.ts:70          │ isValidUrl exported but only used internally                                                 │
  ├─────┼────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────┤
  │ C15 │ app.tsx:169            │ Tautological phase === 'error' check in final return branch                                  │
  ├─────┼────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────┤
  │ C16 │ app.tsx:107-138        │ Single-use renderIdle/renderScraping wrappers — inline them                                  │
  ├─────┼────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────┤
  │ C17 │ terminal.ts:16-38      │ Two structurally identical feature-flag functions — extract generic helper                   │
  ├─────┼────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────┤
  │ C18 │ RecipeCard.tsx:63-99   │ splitTitle reimplements wrapText logic from text-layout.ts                                   │
  ├─────┼────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────┤
  │ C19 │ LandingScreen.tsx:126  │ Nested ternary for inputWidth — extract to function                                          │
  ├─────┼────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────┤
  │ C20 │ text-layout.ts:1-3     │ Array.from(value).length gives false Unicode correctness — use string-width or plain .length │
  └─────┴────────────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────┘

  ---
  Top Priority Actions

  1. Rotate your OpenAI API key now — it's in plaintext in .env.local
  2. Add URL scheme validation in scraper.ts — reject anything that's not http: or https: before Puppeteer navigates
  3. Fix version mismatch — cli.tsx says v2.0.0, package.json says 2.1.0
  4. Validate AI responses — add schema validation so unexpected shapes don't crash downstream
  5. Sanitize terminal output — strip ANSI sequences from scraped data before rendering
  6. Delete dead components — ScrapingStatus.tsx and Welcome.tsx are unused

  Would you like me to start fixing these issues? I can prioritize by severity or tackle them all systematically.
