# Design

## Context

The site is a static GitHub Pages build. Every write today goes to `api.github.com` with the owner's fine-grained token, and the production CSP (`vite.config.ts`) only allows `connect-src 'self' https://api.github.com`. The shelf already has one hidden control: the first squirrel critter is a `role="switch"` button built by `critterItem(kind, shelfPx, interactive)` in `src/shelf/critters.ts`, with a delegated click handler on `#top` in `src/shelf/shelf-view.ts`. Critters are re-created on every render. The first `acorns` critter sits over book 9, so it exists only once the shelf has 9 or more books (it has 42 now). Each manifest book has a `length.pages` count (estimated for EPUBs) and an optional `finishedAt`. Dialogs use the native `<dialog>` helpers in `src/ui/dialog.ts`. The shelf's gzipped JS budget is checked in CI.

The owner chose a Cloudflare Worker with KV and no passcode (see proposal).

## Goals / Non-Goals

**Goals:**
- One small lazily loaded client module, one small Worker, no new npm runtime dependencies.
- The Worker can't affect the site or repository in any way; its worst case is junk in two records.

**Non-Goals:**
- History of past check-ins, per-book standings, or more than two readers.
- Feeding the owner's existing synced reading positions into the board automatically.
- Authentication, a passcode, or rate limiting beyond what Cloudflare gives by default.
- A local dev mock of the Worker beyond what unit tests need.

## Decisions

**1. Cloudflare Worker + KV, separate from the repo's write path.**
`worker/leaderboard/index.ts` exposes `GET /board` and `PUT /board/:reader`. KV holds two keys, `reader:A` and `reader:M`, each `{bookId, title, page, pages, percent, updatedAt}`. The Worker has no GitHub credentials.
*Alternatives:* a Worker committing `leaderboard.json` to the repo (puts a repo-write token on Cloudflare and redeploys the site on each check-in); a public token for a second repo (token visible in devtools, likely auto-revoked). Both rejected in the proposal discussion.

**2. Validation lives in a pure function shared by tests.**
`worker/leaderboard/validate.ts` exports `validateCheckIn(reader, body, catalogue)`: reader in `{A, M}`, body is exactly `{bookId, page, pages}`, `bookId` matches `^[a-z0-9]{10}$` and is in the catalogue, `pages` is an integer 1–10000, `page` an integer 0–`pages`. The Worker rejects bodies over 1 KB before parsing. The title stored comes from the catalogue, never the client. Unit tests import this file directly via a new `tests/unit/leaderboard-validate.test.ts`.

**3. Catalogue = the published manifest, fetched by the Worker.**
The Worker fetches `${SITE_URL}library/manifest.json` (a `wrangler.toml` var) with Cloudflare's cache (`cf: { cacheTtl: 60 }`) so a just-added book becomes valid within a minute or two of its deploy. *Alternative:* trusting a client-sent title — rejected, it'd let anyone store arbitrary text.

**4. CORS limited to the site origin.**
`Access-Control-Allow-Origin` is `ALLOWED_ORIGIN` (a var); `OPTIONS` preflight allows `GET, PUT` and `Content-Type`. This isn't a security boundary (curl ignores it) but stops other websites from writing via visitors' browsers.

**5. Build-time opt-in via `VITE_LEADERBOARD_URL`.**
`vite.config.ts` reads `process.env.VITE_LEADERBOARD_URL`; if set, its origin (`new URL(...).origin`) is appended to `connect-src`. The client reads `import.meta.env.VITE_LEADERBOARD_URL`; if empty, the acorns render as plain decor. CI passes `${{ vars.LEADERBOARD_URL }}` into the build step.

**6. Acorns as a button, mirroring the squirrel.**
Generalize `critterItem`'s `interactive` flag to a role: `'theme-toggle' | 'leaderboard' | undefined`. The leaderboard variant is a plain `<button class="critter critter-leaderboard" aria-label="Acorns">` with no sign and the same hover nudge and focus ring as the squirrel. In `shelf-view.ts`, the first critter whose kind is `acorns` gets the role when the URL is configured. The delegated `#top` click handler calls a new `cb.onLeaderboard()`, which `main.ts` implements by `import('./leaderboard/checkin-dialog')` and passing the current books.

**7. One dialog, swapped step content.**
`src/leaderboard/checkin-dialog.ts` builds one `<dialog>` via `createDialog`/`openDialog` and replaces its body per step: initial → (coming soon | book) → page → board. The initial is a one-character text input (`maxlength=1`, `autocapitalize=characters`). The book step is a native `<select>` (reading books, then an `<optgroup label="Finished">`), with a "Just show the board" text button. The page step has two `inputmode="numeric"` inputs, page and "of N", N prefilled from `length.pages`. All record text is set with `textContent`. Focus returns to the acorns on close (the helper already does this).

**8. Nudges and ranking are pure.**
`src/leaderboard/board.ts` exports `rankBoard(records)` returning ordered rows plus `{behind: 'A' | 'M' | null, tie: boolean}` (tie when |Δ| ≤ 1 point; not-started counts as 0%), and a `NUDGES` list of ~10 lines ("Keep up the pace, toots!", "The book won't read itself, sweet pea.", ...), plus one `TIE_LINE`. The random pick takes an injectable `random` for tests.

**9. Styling within the styleguide.**
Dialog uses the existing `.dialog` component styles. The board is a two-row list with a thin flat progress bar per reader using existing tokens; no new colors.

## Risks / Trade-offs

- [No passcode: anyone who finds the acorns or the Worker URL can overwrite A's or M's record] → Accepted by the owner. Damage is limited to two records; the owner can fix them by checking in again. Documented in the README.
- [Worker URL is public in the built JS] → It's an unauthenticated endpoint by design; validation keeps it to two well-formed records.
- [Estimated EPUB page counts won't match a physical copy] → The total is editable per check-in and stored with the record.
- [KV is eventually consistent, so the other reader may see a stale record for up to ~60 s] → Fine for this use; the saving reader gets the board built from the Worker's response, which includes the record just written.
- [Acorns disappear if the shelf drops below 9 books] → Acceptable; the entry point is hidden by design. Noted in README.
- [CSP now names a third-party origin] → It is connect-only, one exact origin, and absent when unconfigured.

## Migration Plan

Already done in the Cloudflare dashboard (2026-11-08):
- Worker `library-leaderboard` (Hello World placeholder) at `https://library-leaderboard.avaneesh-babu123.workers.dev`, account ID `722d4d650c7a143b92677d6c55e8e387`.
- KV namespace `library-leaderboard`, ID `d11732f769674e0aac6fe53d287c4c88`, bound as `BOARD` (production and previews).
- Plain-text vars, production only: `SITE_URL = https://neeshthecoder.github.io/library/`, `ALLOWED_ORIGIN = https://neeshthecoder.github.io`.

Remaining:
1. Fill `worker/leaderboard/wrangler.toml` with these exact values: `name = "library-leaderboard"`, `account_id`, the `BOARD` KV binding ID, and the same `[vars]`. `wrangler deploy` replaces dashboard vars and bindings with what the file says, so the file must match the dashboard.
2. `npx wrangler login` once, then `npx wrangler deploy` from `worker/leaderboard/`. This replaces the Hello World code.
3. Add the repository variable `LEADERBOARD_URL = https://library-leaderboard.avaneesh-babu123.workers.dev` (Settings → Secrets and variables → Actions → Variables) and push; the next deploy enables the acorns.
4. Rollback: delete the repository variable and redeploy. The acorns go back to decor and the CSP loses the origin. Optionally `wrangler delete` the Worker.
