## Bug Review

### High Priority Bugs

1. Missing Timeout in AI API Call ( scraper.ts:326 )
  • The OpenAI API call has an  AbortSignal  but no explicit timeout. If the API hangs, users will be stuck indefinitely
  • Fix: Add  AbortSignal.timeout(30000)  or similar.
2. Auto-submit Race Condition in URLInput ( URLInput.tsx:42-44 )
  • Auto-submits when sanitized content differs from input (happens on paste with newlines). Could submit before user
  finishes pasting.
  • Fix: Add debounce or remove auto-submit on sanitize, require explicit Enter.
3. Silent JSON Parsing Failures ( scraper.ts:51-54 )
  • Invalid JSON-LD blocks are silently caught and ignored, making debugging difficult.
  • Fix: Log warnings for failed parses to aid troubleshooting.
4. Chrome Path Command Injection ( scraper.ts:202 )
  •  execSync('which chromium-browser || which chromium || which google-chrome 2>/dev/null')  could be vulnerable if
  PATH is manipulated.
  • Fix: Use  child_process.spawn  with validated arguments or safer detection.
5. Recipe Data Validation Gap ( scraper.ts:331-332 )
  • AI response is cast to  Recipe  without validation. Could produce invalid shapes.
  • Fix: Add Zod schema validation or manual validation of required fields.


### Medium Priority Bugs

6. Browser Challenge Detection Race ( scraper.ts:274-280 )
  • Challenge detection waits for it to disappear but could miss the window.
  • Fix: Add content verification before/after wait.
7. Whitespace Collapsing ( text-layout.ts:32 )
  • Multiple spaces collapsed to one, which might affect intentional formatting.
  • Fix: Consider preserving certain whitespace patterns.
8. AbortController Race Condition ( app.tsx:55-56, 62-63 )
  • State checked after async operation; could update with stale state.
  • Fix: Use unique scrape IDs to verify results are for current operation.
9. Synchronous File Read ( LandingScreen.tsx:21-24 )
  •  readFileSync  on module load could delay startup.
  • Fix: Use  fs.promises  with async/await and caching.
10. Error Handling Missing ( useDisplayPalette.ts )
  • No error handling for  write()  failures.
  • Fix: Wrap in try-catch.


--------

## Security Review

### High Priority Issues

11. SSRF via URL Processing ( scraper.ts:268 )
  • No validation that URLs point to legitimate recipe sites. Could scrape internal resources or use  file:/// /
  javascript: .
  • Fix: Whitelist domains, validate schemes (allow only  http / https ), add URL blacklist.
12. User Agent Fingerprinting Incomplete ( scraper.ts:223-227 )
  • WebDriver masking is partial; sites can still detect headless browser via plugins, permissions, or canvas
  fingerprinting.
  • Fix: Add comprehensive masking:  navigator.webdriver ,  navigator.plugins ,  permissions , canvas noise.
13. Puppeteer Permissions Overreach ( scraper.ts:257-261 )
  • No explicit permission restrictions on the browser context.
  • Fix: Add  --disable-dev-shm-usage ,  --disable-background-networking ,  --disable-default-apps .
14. Missing Request Size Limits ( scraper.ts )
  • Large HTML responses could consume excessive memory.
  • Fix: Add  maxContentLength  limit and fail fast.
15. Generic Error Messages ( cli.tsx:66 ,  app.tsx:66 )
  • Could expose internal paths or stack traces in error cases.
  • Fix: Sanitize all error messages before displaying.


### Medium Priority Issues

16. No Request Rate Limiting
  • No protection against rapid/scraping abuse.
  • Fix: Add rate limiting or delay between requests.
17. Unvalidated External Content ( scraper.ts:170-180 )
  • HTML from external sites parsed without sanitization.
  • Fix: Add input validation, strip dangerous tags/attributes before Cheerio parsing.
18. HTTP URLs Allowed ( helpers.ts:72-73 )
  • HTTP is accepted alongside HTTPS.
  • Fix: Prefer HTTPS, warn on HTTP.
19. Missing Input Length Validation
  • Very long URLs or recipe content could cause issues.
  • Fix: Add max URL length (e.g., 2048 chars) and max content size.
20. Dependency Surface Area
  • Many dependencies increase attack surface.
  • Fix: Run  npm audit  regularly, pin dependencies, consider Dependabot/Snyk.


--------

## Code Simplification Opportunities

### High Impact

21. Duplicate  buildOccurrenceKeys  Functions
  • Appears identically in  RecipeCard.tsx:43-51  and  LandingScreen.tsx:66-74 .
  • Move to:  src/utils/helpers.ts  or create  src/utils/react.ts .
22. Complex Recipe Instruction Extraction ( RecipeCard.tsx:17-41 )
  • Nested object handling could be extracted for reusability.
  • Extract to:  extractInstructions()  utility in a shared location.
23. Scattered Status Message Logic
  • Status text logic in multiple components ( Footer.tsx:36-47 ,  LoadingScreen.tsx:12-23 ).
  • Create:  getStatusMessage(phase, status)  utility function.
24. Repeated AbortController Pattern
  • Similar abort logic in  app.tsx:35-73  and  scraper.ts:214-301 .
  • Create:  useAbortableOperation()  hook or  createAbortableWrapper()  utility.
25. URL Validation Split Across Functions
  •  normalizeRecipeUrl()  and  isValidUrl()  in  helpers.ts .
  • Merge: Into  parseAndValidateUrl()  that returns parsed URL or null.


### Medium Impact

26. Terminal Proxy Complexity ( terminal.ts:60-89 )
  • Proxy-based synchronized output could be a simpler class.
  • Simplify: Use a class with explicit methods instead of Proxy.
27. Footer Keybinds Data-Driven
  • Hardcoded keybind mapping could be more maintainable.
  • Move: To constants file or config for easier editing.
28. Layout Calculations Scattered
  • Width/height responsive logic in multiple components.
  • Create:  useResponsiveLayout()  hook to centralize.
29. Time Formatting Tightly Coupled
  •  isoToMinutes()  and  formatMinutes()  always used together.
  • Create:  TimeFormatter  class or  formatDuration(isoString)  function.
30. Color/Theme Access Pattern
  • Direct  theme.colors.*  access throughout components.
  • Create: Helper functions like  getPhaseColor(phase)  for consistency.


### Low Impact

31. Extract Magic Numbers
  • Hardcoded timeouts, widths, and heights scattered.
  • Create:  src/constants.ts  file.
32. Simplify Conditional Rendering
  • Some deeply nested ternaries could use early returns.
  • Refactor: Extract to helper functions or components.
33. Consolidate Error Types
  • Different error handling patterns across codebase.
  • Standardize: Create custom error classes ( ScrapeError ,  ValidationError ).
34. Text Layout Modularization
  •  wrapText()  function does a lot; could be split.
  • Split: Into smaller helpers for word breaking, line joining, etc.
35. Remove Redundant null Checks
  • Some optional chaining could be simplified with better type guards.
  • Refactor: Use type predicates
