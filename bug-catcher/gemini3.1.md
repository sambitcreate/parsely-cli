 Bug Review Plan
Flawed AI Fallback Logic:
Issue: In 

scrapeWithAI
, the URL is simply injected into the GPT prompt: "Scrape this recipe: ${url}". Since gpt-4o-mini doesn't have native web traversal via the API, it's likely to hallucinate a recipe based solely on the URL string rather than parsing real webpage data.
Fix Plan: If Puppeteer fails because there's no JSON-LD (but page loading succeeds), we shouldn't throw the HTML away! We should pass the extracted HTML text to the AI. If the browser launch completely fails, 

scrapeWithAI
 should do a raw HTTP fetch() to grab the text content and pass it into the prompt.
Synchronous Code Freezing the TUI:
Issue: The 

findChrome
 function uses execSync to locate Chromium install paths. Since the app is built on React Ink (running in a single Node thread), synchronous calls can freeze terminal rendering.
Fix Plan: Replace execSync with a short asynchronous file presence check over CHROME_PATHS using fs.promises.access, avoiding blocking operations or child processes.
Fragmented Browser Cleanup:
Issue: Puppeteer's browser.close() is currently scattered across the success flow, the catch block, and the abort listener. If an unhandled exception manages to interrupt the flow, the headless browser instance might be orphaned.
Fix Plan: Refactor the browser initialization inside a standard try...finally { if (browser) await browser.close(); } structure.
🔒 Security Review Plan
Unsanitized URL Inputs (CLI Args vs Input Component):
Issue: Through the CLI terminal interface parsely <url>, the URL argument is blindly assigned to 

app.tsx
 passing into 

scrapeRecipe
. It skips the 

normalizeRecipeUrl
 validation available in 

utils/helpers.ts
! A user could accidentally (or maliciously, if run programmatically) input a file:/// URI or internal pointer, triggering a Server-Side Request Forgery (SSRF) or Local File Read risk through Puppeteer.
Fix Plan: Apply 

normalizeRecipeUrl
 and strict http/https protocol validation directly at the top of 

scrapeRecipe
 or immediately while parsing args in 

cli.tsx
.
Safe Command Execution:
Issue: execSync('which chromium-browser || ...') is vulnerable to shell/PATH environment poisoning.
Fix Plan: By removing execSync and falling back explicitly on Node's async file system tools (as mentioned in the Bug plan), we cleanly bypass this risk.
🧹 Code Simplification Plan
Refactor the Headless Browser Setup:
Instead of manually sniffing for Chrome globally (which causes compatibility headaches), you're currently using puppeteer-core. Although this keeps bundle sizes low, managing Chrome manually requires boilerplate logic.
Plan: I'll clean up the 

findChrome
 paths and rely purely on non-blocking path resolution logic.
Simplify JSON-LD Traversal (

findRecipeJson
):
Issue: The current traversal for finding the JSON Schema with @type === 'Recipe' iterates manually over candidates and dynamically pushes items to process.
Fix Plan: This can be squamped down to a cleaner recursive function handling nested arrays naturally.
Streamline Data Normalization:
Issue: Functions like 

normalizeInstruction
 in 

scraper.ts
 have very heavy, boilerplate-heavy arrays bounds checking (Array.isArray(...)).
Fix Plan: They can be shortened down dramatically using Modern TS optional chaining (?.), mapped variables, and cleaner type narrowing.
Let me know if you would like me to proceed with implementing any of these fixes or if you want me to expand further on a particular area!