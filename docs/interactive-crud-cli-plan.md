# Interactive Parsely CLI CRUD Plan

Branch: `plan/interactive-recipes-crud-cli`

This plan synthesizes five read-only GPT-5.5 xhigh agent passes across
`parsely-cli` and `parsely-users`.

## Executive Decision

Build Parsely CLI into an authenticated full-screen cookbook TUI, while keeping
the current `parsely <url>` local scraper behavior intact.

The implementation should target the current checked-in backend reality:
`parsely-users` is a Convex Auth app today, not a Clerk app. Clerk remains a
viable future migration, but it should not be bundled into the CLI feature
unless the web/backend auth migration is explicitly reopened first.

Recommended auth track:

1. Ship CLI auth against current Convex Auth.
2. Use Convex/Next bearer-token support for parse, Ask Chef, billing, and
   cookbook/folder CRUD.
3. Treat Clerk OAuth + Convex as a separate migration project if the product
   still wants Clerk as the long-term provider.

Recommended CRUD scope:

- Full CRUD for the user's cookbook association, folder organization, favorite
  state, pin state, selected servings, recipe overrides, and share tokens.
- URL import/create through the canonical backend parse flow.
- Manual recipe creation as owner-private recipe data only after a backend
  contract is added.
- Do not present global catalog recipe deletion or arbitrary catalog edits as
  available behavior. The current backend intentionally treats `recipes` as
  shared catalog rows or owner-private source rows, while user-editable state
  lives in `userRecipes`.

## Current State

### CLI

`parsely-cli` is currently a standalone Ink app:

- `src/cli.tsx` parses `--help`, `--version`, and an optional URL.
- `src/cli-runtime.ts` owns alternate-screen entry/exit, synchronized output,
  and palette cleanup.
- `src/app.tsx` owns the scrape-only state machine:
  `idle -> scraping -> display`, with `error -> scraping` retry.
- `src/services/scraper.ts` uses Puppeteer/Cheerio first, OpenAI fallback
  second.
- Tests are focused on helpers, layout decisions, shortcuts, runtime cleanup,
  and PTY smoke behavior.

This is a good base. Keep `src/cli-runtime.ts` conceptually unchanged and evolve
the React tree into an authenticated app shell.

### Backend

`parsely-users` is the source of truth for Convex schema and APIs.

Existing Convex functions usable by a CLI with a valid auth token:

- `userRecipes.list`
- `userRecipes.save`
- `userRecipes.remove`
- `userRecipes.toggleFavorite`
- `userRecipes.togglePin`
- `userRecipes.move`
- `userRecipes.updateOverride`
- `userRecipes.getFilters`
- `userRecipes.getByRecipeId`
- `userRecipes.bulkDelete`
- `userRecipes.bulkFavorite`
- `userRecipes.bulkMove`
- `userRecipes.generateShareToken`
- `userRecipes.revokeShareToken`
- `folders.list`
- `folders.create`
- `folders.rename`
- `folders.deleteFolder`
- `mobile.fullSync`
- `mobile.saveRecipeFromMobile`
- `mobile.bulkSyncFromMobile`
- `recipes.getById`

Existing HTTP routes:

- `/api/parse` already supports `Authorization: Bearer`.
- `/api/ask-chef` already supports `Authorization: Bearer`.
- `/api/billing/status` already supports `Authorization: Bearer`.
- Most recipe and folder CRUD routes currently use only
  `convexAuthNextjsToken()`, so bearer-token CLI calls will not work until they
  share a `cookieToken || bearerToken` helper.

Backend gap:

- Add a shared API auth helper, for example `getApiAuthToken(request)`, and use
  it across recipe/folder routes.
- Add idempotent state setters for CLI where current routes only toggle
  favorite/pin.
- Decide whether manual create means owner-private recipe creation via
  `mobile.saveRecipeFromMobile` or a new first-class REST route.

### Auth Reality

Checked-in `parsely-users` uses:

- `@convex-dev/auth`
- `@auth/core`
- `ConvexAuthNextjsProvider`
- Convex Auth providers: Google, Resend magic link, Password, and the internal
  `password-change` credentials provider.

Checked-in `parsely-users` does not include direct `@clerk/*` dependencies.

Convex Auth should therefore be the CLI MVP. Clerk should be planned as a
separate auth migration:

- Add `@clerk/nextjs`.
- Replace provider wiring with `ClerkProvider` and `ConvexProviderWithClerk`.
- Configure `CLERK_JWT_ISSUER_DOMAIN`.
- Map Clerk identities to the existing Convex Auth `users._id` model or migrate
  all auth-owned data.
- Register a Clerk OAuth public client for CLI authorization-code + PKCE.

Do not mix this Clerk migration into the first CLI CRUD build.

## Target Product

Default `parsely` should open a logged-in cookbook TUI when authenticated, or an
auth/welcome screen when signed out.

CLI commands:

- `parsely` - open interactive cookbook.
- `parsely <url>` - preserve current URL scrape behavior.
- `parsely login` - start CLI auth.
- `parsely logout` - revoke/clear local auth.
- `parsely whoami` - show current signed-in account and backend environment.
- `parsely --local <url>` - force current local scraper path.
- `parsely --cloud <url>` - force backend parse/save path when signed in.

In-app routes:

```text
boot
auth
library
detail
import-url
import-review
create
edit
folders
folder-picker
confirm
error
```

Keep import/scrape progress as a nested flow rather than letting
`idle/scraping/display/error` remain the whole app.

## UX Plan

Authenticated shell:

- Wide terminal: folder/sidebar on the left, list/detail on the right.
- Medium terminal: narrow sidebar and single main column.
- Narrow terminal: top breadcrumb/segmented navigation, no sidebar.
- Short terminal: hide nonessential descriptions and secondary panels.
- Emergency small view: single-pane list/detail with compact footer.

Main screens:

- Auth screen: login prompt, browser handoff status, retry, logout stale token.
- Library: All Recipes, Saved, Pinned, custom folders, search, sort, pagination.
- Detail: recipe deck adapted from current `RecipeCard`, including source host,
  timing, servings, ingredients, instructions, nutrition, tags, favorite/pin,
  folder, and share state.
- Import URL: reuse current `URLInput`; signed-in default calls backend
  `/api/parse` with `returnData: true`.
- Create/edit: manual recipe draft fields; for MVP, persist supported user
  overrides and owner-private recipes only where backend allows.
- Folder manager: create, rename, delete, and virtual-folder separation.
- Confirm dialogs: delete/remove, discard dirty edits, rotate share link.

Shortcuts:

- Global: `ctrl+c` abort/exit, `ctrl+t` theme, `?` help, `esc` back/close.
- Library/detail: `up/down` or `j/k`, `enter`, `/` search, `ctrl+l` clear,
  `r` refresh, `i` import, `n` create, `e` edit, `f` favorite, `p` pin,
  `m` move, `d` delete/remove, `F` folders, `q` quit from top level.
- Forms: `tab`, `shift+tab`, `enter`, `ctrl+n` add item, `ctrl+d` remove item,
  `ctrl+s` save, `esc` cancel with dirty confirmation.

Visual rules:

- Preserve Parsely green, paper background, orange accent, and current wordmark.
- Keep the one-row render buffer from `getRenderableHeight()` to avoid Ink
  full-screen redraw flicker.
- Do not rely on color alone. Pair state with symbols/text such as selected
  marker, `PIN`, `ERR`, and `FAV`.
- Continue avoiding broad Ink snapshots; prefer pure helper/reducer tests.

## Architecture Plan

New modules in `parsely-cli`:

```text
src/models/recipe.ts
src/types/parsely-api.ts
src/state/navigation-reducer.ts
src/state/commands.ts
src/state/recipe-controller.ts
src/services/auth-service.ts
src/services/auth-session.ts
src/services/credential-store.ts
src/services/convex-client.ts
src/services/parsely-api.ts
src/services/recipe-repository.ts
src/services/recipe-mapper.ts
src/utils/api-errors.ts
src/utils/form-state.ts
src/utils/list-layout.ts
```

New/changed components:

```text
src/components/AppFrame.tsx
src/components/AuthScreen.tsx
src/components/CommandBar.tsx
src/components/HelpOverlay.tsx
src/components/Sidebar.tsx
src/components/ShortcutFooter.tsx
src/components/RecipeList.tsx
src/components/RecipeDetail.tsx
src/components/RecipeForm.tsx
src/components/FolderManager.tsx
src/components/FolderPicker.tsx
src/components/ImportUrlScreen.tsx
src/components/ConfirmDialog.tsx
```

Existing files to keep and adapt:

- Keep `src/cli-runtime.ts` as the terminal lifecycle owner.
- Update `src/cli.tsx` to parse subcommands and initial routes.
- Split `src/app.tsx` into route orchestration and screen composition.
- Adapt or wrap `src/components/RecipeCard.tsx` for authenticated `RecipeView`
  data.
- Keep `src/services/scraper.ts` for local scrape and guest fallback.

Data model boundaries:

- `ScrapedRecipe`: current transient local extraction result.
- `RecipeDocument`: backend `recipes` row.
- `UserRecipeState`: folder, favorite, pin, selected servings, override, share
  token, created timestamp.
- `RecipeView`: merged UI model for list/detail.
- `RecipeDraft`: form model for import/create/edit.
- `Folder`: folder id, name, created timestamp, virtual/custom marker.

Network boundaries:

- Use `ParselyApiClient` for HTTP calls.
- Use `ConvexHttpClient.setAuth()` when calling Convex directly.
- Use Convex `anyApi` or small local function-reference helpers if generated
  backend API files are not imported into the CLI package.
- Prefer backend `/api/parse` for signed-in imports so SSRF validation, rate
  limits, Gemini extraction, dedup, and auto-save stay centralized.

## Auth Plan

### MVP: Convex Auth

Use the current backend auth model.

CLI auth components:

- `AuthService`: login, refresh, logout, whoami.
- `CredentialStore`: OS keychain where available; `0600` local file fallback
  for dev only, with clear warnings.
- `AuthSession`: `{ appUrl, convexUrl, accessToken, refreshToken, expiresAt }`.

Flows:

1. `parsely login`
   - MVP can support password auth with minimal backend change.
   - Preferred product flow is browser-based login with localhost callback.
   - Headless/SSH fallback can be a custom device-like code flow later.
2. Refresh
   - Refresh before expiry.
   - Replace refresh tokens atomically if Convex Auth rotates them.
3. Logout
   - Call backend sign-out when possible.
   - Always clear local credentials.
4. Request auth
   - Attach bearer tokens only to trusted `https://parsely.us` by default.
   - Allow localhost/dev URLs only through explicit `PARSELY_API_BASE_URL`.

Backend support:

- Confirm the exact non-React Convex Auth token exchange shape in a spike.
- Add a small auth bridge if browser login cannot return CLI-usable tokens
  cleanly.
- Add `GET /api/cli/me` or equivalent to validate token and return user/tier.

### Deferred: Clerk

If the product still wants Clerk, do this as a separate branch/project:

- Install and configure Clerk in `parsely-users`.
- Replace Convex Auth provider wiring with Clerk-compatible wiring.
- Add Clerk-to-existing-user migration/mapping.
- Configure Convex `auth.config.ts` with Clerk issuer.
- Register a Parsely CLI OAuth public client.
- Implement authorization-code + PKCE with localhost callback in the CLI.
- Pass Clerk OIDC JWTs into Convex via `setAuth`.

This should not block the Convex Auth CLI MVP.

## Backend Implementation Plan

Milestone 0: auth source-of-truth cleanup.

- Update stale docs that say Clerk is live if they conflict with checked-in
  Convex Auth.
- Decide whether CLI MVP uses direct Convex calls, REST routes, or a dedicated
  `/api/cli` facade.

Milestone 1: bearer-token parity.

- Add shared route helper, for example:

```ts
export async function getApiAuthToken(request: NextRequest) {
  const cookieToken = await convexAuthNextjsToken();
  const bearerToken =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null;
  return cookieToken || bearerToken;
}
```

- Apply to:
  - `/api/recipes`
  - `/api/recipes/[id]`
  - `/api/recipes/[id]/save`
  - `/api/recipes/[id]/favorite`
  - `/api/recipes/[id]/pin`
  - `/api/recipes/[id]/share`
  - `/api/recipes/bulk`
  - `/api/recipes/move`
  - `/api/recipes/remove`
  - `/api/recipes/filters`
  - `/api/folders`
  - `/api/folders/[id]`

Milestone 2: CLI-friendly state setters.

- Add idempotent favorite/pin setters, or a single user recipe state mutation:

```ts
patchUserRecipeState({
  recipeId,
  isFavorite?,
  isPinned?,
  folderId?,
  selectedServings?,
  recipeOverride?,
})
```

- Keep current toggle routes for web compatibility.

Milestone 3: manual create.

- Either expose a REST wrapper over `mobile.saveRecipeFromMobile`, or add a
  dedicated owner-private manual recipe mutation.
- Enforce the same payload caps as mobile import.

Milestone 4: tests.

- Add bearer-token variants for every touched route test.
- Add idempotent state setter tests.
- Add ownership/security tests with `convex-test`.

## CLI Implementation Plan

Milestone 1: command parser and config.

- Add subcommands: `login`, `logout`, `whoami`.
- Add env support:
  - `PARSELY_API_BASE_URL`
  - `PARSELY_CONVEX_URL`
  - `PARSELY_AUTH_TOKEN` for CI/dev only
  - `PARSELY_TOKEN_STORE`
- Preserve `parsely <url>`.

Milestone 2: service layer.

- Implement credential/session abstractions.
- Implement authenticated API client.
- Implement recipe repository.
- Implement recipe mappers from Convex/REST/local-scraper shapes into
  `RecipeView`.

Milestone 3: state and shell.

- Replace scrape-only phase state with reducer/route stack.
- Add global command registry.
- Add authenticated `AppFrame`.
- Keep dedicated loading/auth/error screens.

Milestone 4: read/list/detail.

- Load folders and first recipe page.
- Add list navigation, search, folder filtering, saved/pinned filters.
- Add detail view with scrolling and current `RecipeCard` visual language.

Milestone 5: mutation flows.

- Favorite/pin.
- Move to folder.
- Remove from cookbook.
- Folder create/rename/delete.
- Share token generate/revoke.
- Edit servings and overrides.
- Import URL through backend parse.

Milestone 6: manual create/edit expansion.

- Add manual owner-private create once backend contract exists.
- Expand edit behavior to whatever backend explicitly supports.

## Test Plan

CLI unit tests:

```text
test/navigation-reducer.test.ts
test/commands.test.ts
test/api-client.test.ts
test/auth-session.test.ts
test/credential-store.test.ts
test/recipe-mapper.test.ts
test/recipe-repository.test.ts
test/list-layout.test.ts
test/detail-layout.test.ts
test/form-state.test.ts
test/folder-actions.test.ts
```

Keep and expand:

- `test/cli-runtime.test.ts`
- `test/cli-pty.test.ts`
- `test/shortcuts.test.ts`
- `test/ui-layout.test.ts`
- `test/text-layout.test.ts`

Backend tests:

- Route tests for bearer auth on every CRUD route.
- Convex ownership/security tests for private recipes and folders.
- Rate-limit tests for direct Convex and HTTP route parity.

Commands:

```bash
cd /Users/sambitbiswas/projects/parsely/parsely-cli
npm install
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

If TUI layout changes:

```bash
cd /Users/sambitbiswas/projects/parsely/parsely-cli
npx -y react-doctor@latest . --verbose --diff
```

Backend verification:

```bash
cd /Users/sambitbiswas/projects/parsely/parsely-users
pnpm install
npx convex dev --once
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Targeted backend tests:

```bash
cd /Users/sambitbiswas/projects/parsely/parsely-users
pnpm test -- app/api/recipes/__tests__/route.test.ts
pnpm test -- 'app/api/recipes/[id]/__tests__/route.test.ts'
pnpm test -- app/api/folders/__tests__/route.test.ts
pnpm test -- 'app/api/folders/[id]/__tests__/route.test.ts'
```

Manual PTY smoke:

```bash
cd /Users/sambitbiswas/projects/parsely/parsely-cli
PARSELY_SYNC_OUTPUT=0 PARSELY_DISPLAY_PALETTE=0 npm start
PARSELY_API_BASE_URL=http://localhost:3000 PARSELY_SYNC_OUTPUT=0 PARSELY_DISPLAY_PALETTE=0 npm start
PARSELY_API_BASE_URL=http://localhost:3000 npm start -- https://www.simplyrecipes.com/recipes/perfect_guacamole/
```

## Release Plan

1. Land backend bearer-token parity first.
2. Land CLI auth/service layer behind minimal UI.
3. Land read-only library/detail TUI.
4. Land mutation flows.
5. Land import/create/edit flows.
6. Update docs:
   - `README.md`
   - `CHANGELOG.md`
   - `AGENTS.md`
   - `CLAUDE.md`
7. Add or update CLI CI:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

8. Publish as `3.0.0-beta.0` if auth/cloud CRUD becomes central behavior.
9. Promote after manual verification on macOS Terminal, Ghostty, WezTerm, and
   one Linux terminal.

## Highest Risks

- Token lifecycle is the biggest unknown. Do not build the full TUI before a
  working login/refresh/logout spike.
- Current docs disagree about Clerk vs Convex Auth. The code is Convex Auth.
- Bearer support is inconsistent across CRUD routes today.
- Untrusted API base URLs can exfiltrate tokens. Default to `https://parsely.us`
  and require explicit dev config for localhost.
- "Full CRUD" can be misunderstood. The backend currently supports user
  cookbook CRUD and user-local overrides, not arbitrary global catalog edits.
- Terminal cleanup can regress as async network flows multiply. Keep
  `src/cli-runtime.ts` isolated and abort in-flight work on exit.
- Local OpenAI scraper output and backend Gemini parse output have different
  shapes. Use strict mappers and prefer backend parse for signed-in imports.
