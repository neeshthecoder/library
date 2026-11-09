# Tasks

## 1. Progress store (Worker)

- [x] 1.1 Add `worker/leaderboard/validate.ts`: a dependency-free `validateCheckIn(reader, body, catalogue)` per design decision 2 (reader A/M, exact `{bookId, page, pages}` keys, id pattern and catalogue membership, integer ranges, title taken from catalogue, percent computed). Verify with `tests/unit/leaderboard-validate.test.ts` covering each "Constrained progress store" scenario; `npm test` passes.
- [x] 1.2 Add `worker/leaderboard/index.ts` with `GET /board`, `PUT /board/:reader`, `OPTIONS` preflight, 1 KB body cap, CORS locked to `ALLOWED_ORIGIN`, manifest fetch from `SITE_URL` with `cacheTtl: 60`, and KV keys `reader:A` / `reader:M`. Declare the few KV/Env types it needs locally (no new npm deps) and keep `worker/` out of the site's `tsconfig` include. Verify the request handler is exported so a unit test can call it with a fake KV and fake fetch: a valid PUT returns both records, an invalid one returns 400 and leaves KV untouched.
- [x] 1.3 Add `worker/leaderboard/wrangler.toml` with the existing dashboard setup from design.md's Migration Plan (`name = "library-leaderboard"`, `account_id`, `main`, `compatibility_date`, KV binding `BOARD` → `d11732f769674e0aac6fe53d287c4c88`, and `[vars]` `SITE_URL` / `ALLOWED_ORIGIN` matching the dashboard). Verify `npx wrangler deploy --dry-run` from that folder bundles without errors.
- [x] 1.4 Run `npx wrangler deploy` (after `npx wrangler login`) to replace the Hello World placeholder. Verify `curl https://library-leaderboard.avaneesh-babu123.workers.dev/board` returns both readers as not started, and a PUT with an unknown book returns 400.

## 2. Board logic

- [x] 2.1 Add `src/leaderboard/board.ts` with `rankBoard(records)` (order by percent, not-started = 0%, tie within 1 point, `behind` reader), `NUDGES` (~10 playful lines including "Keep up the pace, toots!"), `TIE_LINE`, and a nudge picker taking an injectable `random`. Verify with `tests/unit/leaderboard-board.test.ts` covering the "Two-reader leaderboard" and "Nudge for the reader behind" scenarios.
- [x] 2.2 Add `src/leaderboard/api.ts`: `getBoard()` and `saveCheckIn(reader, {bookId, page, pages})` against `import.meta.env.VITE_LEADERBOARD_URL`, throwing a typed error on network failure or non-2xx. Verify with a unit test using a stubbed `fetch` (success, 400, network error).

## 3. Acorn entry point and dialog

- [x] 3.1 In `src/shelf/critters.ts`, replace the boolean `interactive` with a role (`'theme-toggle' | 'leaderboard'`); the leaderboard role renders a `<button class="critter critter-leaderboard" aria-label="Acorns">` with no sign. Extend `tests/unit/critters.test.ts` (or a new happy-dom test) to check both roles' markup and that the default stays `aria-hidden` decor.
- [x] 3.2 In `src/shelf/shelf-view.ts`, give the first `acorns` critter the leaderboard role only when `VITE_LEADERBOARD_URL` is set, and route its delegated click to a new `cb.onLeaderboard()`. Add hover/focus styles in `src/shelf/bookcase.css` matching the squirrel (reduced-motion respected). Verify in `npm run dev` with and without the env var: the acorns are a focusable button only when set; later acorn pairs stay decor.
- [x] 3.3 Add `src/leaderboard/checkin-dialog.ts` (+ `leaderboard.css`): initial → "Feature Coming Soon!" or book `<select>` (reading, then "Finished" optgroup; last book preselected; "Just show the board") → page / "of N" inputs with inline validation → board with nudge. Use `textContent` for all stored text and keep entries on save failure with a retry. Wire `cb.onLeaderboard` in `src/main.ts` via dynamic `import()`. Verify with a Playwright spec `tests/e2e/leaderboard.spec.ts` that routes the Worker URL to a fake: Q → coming soon and close; M → book → page 173/346 → board shows 50% and a nudge for the lower reader; offline save shows the error and keeps the page; a title containing `<b>` renders literally; Escape closes without a PUT.
- [x] 3.4 Run the axe check from `tests/e2e/a11y.spec.ts` against the open dialog on each step and verify no violations.

## 4. CSP, build, and CI

- [x] 4.1 In `vite.config.ts`, append the origin of `process.env.VITE_LEADERBOARD_URL` to `connect-src` when set. Verify with a unit test (or a build + grep of `dist/index.html`) that the CSP contains exactly that one extra origin when set and is unchanged when unset.
- [x] 4.2 In `.github/workflows/deploy.yml`, pass `VITE_LEADERBOARD_URL: ${{ vars.LEADERBOARD_URL }}` to the Build step. Verify by reading the workflow diff and, after setup, that a deploy's `index.html` CSP includes the Worker origin.
- [x] 4.3 Run `npm run build` and `npm run check:size`; verify the shelf JS stays within budget and the dialog code lands in a separate lazily loaded chunk.

## 5. Documentation

- [x] 5.1 Add a "Reading leaderboard" section to `README.md`: what the acorns do, Worker setup (KV namespace, `wrangler.toml` vars, `npx wrangler deploy`, `LEADERBOARD_URL` repository variable), rollback, the no-passcode tradeoff, and that the acorns need 9+ books. Add the acorn button to the "Styleguide exemptions → Critters" bullet and the extra origin to "Security notes". Verify the documented commands match the files from groups 1 and 4.

## 6. Integration check

- [ ] 6.1 Deploy the Worker, set `LEADERBOARD_URL`, push, and on the live site check in as M from a phone and as A from a laptop; verify each sees the other's record and the nudge lands on the reader behind.

## Workflow follow-up

- When `build-digital-library` is archived, amend `site-shell`'s "Content Security Policy" requirement to allow the leaderboard store origin, then archive this change.
