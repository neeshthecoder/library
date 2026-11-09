# Proposal

## Why

Two people read from this shelf, but only the owner (with a GitHub token) can write anything to the site. The owner's girlfriend has no GitHub account, so there's no easy way for her to log where she is in a book, or for either of them to see how the other is doing. A tiny, hidden check-in with a two-person leaderboard fixes that, without handing out repository access.

## What Changes

- The first pair of acorns on top of the bookcase becomes a hidden button (like the squirrel day/night switch). Clicking it opens a small check-in dialog.
- The dialog asks for an initial. Any letter other than **A** or **M** (case-insensitive) shows "Feature Coming Soon!" with a way to close.
- For **A** or **M**, the dialog asks which book from the catalogue (the shelf's manifest) is being read, then the last page read, and computes percent complete from the book's page count.
- After saving, it shows a mini leaderboard: both readers, their current book, page, and percent. The reader who's behind gets a randomly picked playful nudge ("Keep up the pace, toots!"). A "just show the board" option lets either person peek without updating.
- A new, tiny Cloudflare Worker with a KV namespace stores the two readers' latest check-ins. It is the only new write path, it accepts only `{reader: A|M, bookId, page, pages}`, validates the book against the published manifest, and has no access to the GitHub repository.
- The production Content Security Policy gains exactly one extra `connect-src` origin: the Worker's. If no Worker URL is configured at build time, the acorns stay purely decorative and the CSP is unchanged.
- No passcode (by the owner's choice): anyone who finds the acorns can check in as A or M. The blast radius is limited to the two leaderboard records.

## Capabilities

### New Capabilities
- `reading-leaderboard`: the hidden acorn check-in, its initial/book/page flow, the two-reader leaderboard with nudges, and the constrained progress store it writes to.

### Modified Capabilities
- None in `openspec/specs/` (it is empty). Note: the unarchived `build-digital-library` change's `site-shell` "Content Security Policy" requirement says connections go only to the site and `api.github.com`. This change allows one more origin (the leaderboard Worker); the `reading-leaderboard` spec states that allowance, and `site-shell`'s wording should be amended when `build-digital-library` is archived.

## Impact

- **Code:** `src/shelf/critters.ts` and `src/shelf/shelf-view.ts` (acorns become a button), a new lazily loaded `src/leaderboard/` module (dialog, API client, nudges), `src/shelf/bookcase.css` (button styles), `vite.config.ts` (CSP origin from `VITE_LEADERBOARD_URL`).
- **New service:** `worker/leaderboard/` (Cloudflare Worker + `wrangler.toml`), deployed by hand with a free Cloudflare account.
- **CI:** `.github/workflows/deploy.yml` passes a `LEADERBOARD_URL` repository variable into the build.
- **Budget:** the dialog loads only on acorn click, so the shelf's JavaScript budget is essentially unaffected.
- **Docs:** README gets a short section on setting up the Worker and on the no-passcode tradeoff; the styleguide exemptions mention the acorn button.
