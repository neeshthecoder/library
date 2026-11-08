# Tasks

## 1. Static shell and deploy

- [x] 1.1 Initialize Vite + vanilla TypeScript project (`package.json`, `tsconfig.json` strict, `vite.config.ts` with `base` from `BASE_PATH`, `es2022` target), add `vitest` and `@playwright/test`; verify `npm run dev`, `npm run build`, and `npm test` all succeed on an empty app
- [x] 1.2 Create the module layout from design §1 (`src/{shelf,spines,import,reader,storage,styles}`), seed `library/manifest.json` (`{"version":1,"books":[]}`) and `library/books/.gitkeep`; verify the dev server serves `/library/manifest.json`
- [x] 1.3 Add `src/styles/tokens.css` (all styleguide color, radius, shadow, spacing, type-scale, motion tokens) and `base.css` (paper background, ink text, focus ring, reduced-motion reset); verify with a unit test that tokens.css declares every styleguide token and that no hex values appear outside tokens.css and `src/spines/**`
- [x] 1.4 Self-host Instrument Serif 400 and Inter variable Latin WOFF2 in `public/fonts/`, write `@font-face` with `font-display: swap`, preload the serif, generate metric-matched fallbacks with `fontaine`; verify in the built HTML that the preload exists, no third-party font requests occur, and a Playwright trace shows CLS < 0.05 on throttled load
- [x] 1.5 Add the CSP meta tag (design §9), `<meta name="robots" content="noindex, nofollow">`, and `public/robots.txt`; verify a Playwright test that a `fetch` to a non-allowed host is blocked
- [x] 1.6 Implement `router.ts` (hash routes `#/` and `#/read/:id`, unknown id → shelf + message) and a shell that renders placeholder views; verify unit tests for route parsing and a Playwright test that back/forward and reload work
- [x] 1.7 Add `scripts/check-size.mjs` (gzip the shelf entry chunk + static imports from Vite's manifest, fail ≥ 150 KB) as `npm run check:size`; verify it passes now and fails when a large dummy import is added
- [x] 1.8 Add `.github/workflows/deploy.yml` (push to main + dispatch, Pages permissions, `concurrency: pages` with cancel-in-progress, Node 22 npm cache, test → build → check:size → copy `library/` into `dist/` → upload-pages-artifact → deploy-pages); verify by pushing to a test repo with Pages enabled and loading the deployed URL under `/<repo>/`
- [ ] 1.9 Write `README.md` covering setup, Pages enablement, PAT creation (single repo, Contents read/write, expiry), and a "Styleguide exemptions" section (spines/ribbons/shelf plank, dashed drag overlay, book content typography); verify the steps by following them on the test repo

## 2. Spines and shelf

- [x] 2.1 Implement `contrast.ts` (WCAG relative luminance, contrast ratio, `pickTitleInk(bg, trim)`) with unit tests, including a coarse sRGB sweep proving paper/ink always reach ≥ 4.5:1
- [x] 2.2 Implement `palette.ts` (OKLCH dark/light modes, complementary/analogous trim hue, bisection to ≥ 3.5:1, gamut clamp, bounded retries, seedable RNG); verify unit tests over 10,000 seeds that every pair is ≥ 3:1 and in sRGB gamut
- [x] 2.3 Implement `geometry.ts` (stable `hash01(id)`, height 0.74–0.98, length-based width with jitter, 44 px floor at render) with unit tests for determinism, range bounds, and long-vs-short book ordering
- [x] 2.4 Build the Frame trim (`trims/frame.ts`): head cap, mirrored foot cap, stretchable middle panel, low-detail variant under ~56 px, returns SVG + title box; verify Vitest snapshots at three sizes and a side-by-side visual check against `design/spine-trims.png`
- [x] 2.5 Build the Medallion trim (`trims/medallion.ts`): label plate, star medallion, arched panel, lattice + sprig foot; verify snapshots at three sizes and visual check against the reference
- [x] 2.6 Build the Arch trim (`trims/arch.ts`): fleuron semicircle caps, ogee panel, four sparkles; verify snapshots at three sizes and visual check against the reference
- [x] 2.7 Implement the cover-derived spine renderer (flat dominant background, two accent bands, title panel) and the shared `renderSpine(book, shelfHeight)` that handles both sources, sets `--bg`/`--trim`/`--title-ink` custom properties, and adds the ribbon when a position exists; verify unit tests that recoloring changes only custom properties and that the ribbon appears only with a position
- [x] 2.8 Implement `title-fit.ts` (injected measurer, one-line → two-line → ellipsis passes, 20 px→11 px, word-boundary truncation, cache) and the vertical `writing-mode` title layer; verify unit tests with a fake measurer for short, long, and extreme titles, and that the full title remains in the accessible name and `title` attribute
- [x] 2.9 Build the shelf view: centered `h1` "The bookshelf.", flush-left spine list ordered by `addedAt` ascending with hash-based gaps, shelf plank ending 1.5rem past the last spine, empty state line "Drop a book anywhere to add it.", "Add book" secondary pill, size readout placeholder; render from a fixture manifest and verify with a Playwright screenshot at 320, 768, and 1440 px
- [x] 2.10 Implement `wheel-scroll.ts` (vertical→horizontal with `deltaMode` normalization, pass-through at the ends) and the thin scrollbar styles; verify unit tests for the delta logic and a Playwright test that wheeling scrolls the shelf and, at the end, scrolls the page
- [x] 2.11 Add roving-tabindex keyboard navigation (Left/Right/Home/End, Enter/Space opens the reader route), hover/focus lift (transform, 150 ms, disabled under reduced motion), and the progress `aria-describedby` on started spines; verify Playwright keyboard tests and an axe-core scan with no violations

## 3. Library storage

- [x] 3.1 Define manifest types and pure ops in `storage/manifest.ts` (`addBook`, `removeBook`, `setPosition` newest-wins, `merge(remote, pendingOps)`, version check); verify unit tests including an unknown-version rejection and concurrent-add merge
- [x] 3.2 Implement `storage/cache.ts` on `idb` (stores `files`, `positions`, `pending`, `settings`; `persist()` request; LRU eviction on `QuotaExceededError`); verify unit tests with `fake-indexeddb` for put/get, eviction order, and quota retry
- [x] 3.3 Implement the manifest loader: published fetch with cache-busting query, API raw read when connected, merge with pending ops into the store; verify unit tests with mocked fetch for each path and the "just added, not yet deployed" case
- [x] 3.4 Implement `storage/github.ts` Git Data flow (get ref → blob(s) → tree → commit → non-force ref update, 3 retries re-applying the operation on 422, blob reuse, XHR upload progress, chunked base64); verify unit tests against a mocked GitHub API covering success, conflict-then-success, and auth failure
- [x] 3.5 Build the "Connect your library" dialog (owner/repo/branch prefilled from `location`, password-type token field, `GET /repos` + `permissions.push` verification, public-visibility and git-history notice) and "Library settings" with Disconnect; verify Playwright tests with mocked API for valid token, read-only token error, and disconnect clearing settings
- [x] 3.6 Wire the size readout ("N books · X MB of about 1 GB", warning over 800 MB) to the effective manifest; verify unit tests for formatting and the threshold message
- [x] 3.7 Implement delete in storage (`removeBook` commit with `sha: null` tree entry, clear cache entries, drop locally cached files for books missing from a newer manifest); verify unit tests with the mocked API and a fixture where a remote deletion purges the local file

## 4. Upload and preview

- [x] 4.1 Implement `drag-overlay.ts` as a pure counter reducer plus DOM binding (Files-only, `dragover` preventDefault, reset on drop/dragend, 150 ms watchdog) and the dashed full-window overlay with "Drag file here"; verify reducer unit tests (nested enter/leave, missed leave, non-file drag) and a Playwright test that dispatches synthetic drag events across child elements without flicker
- [x] 4.2 Implement `sniff.ts` (PDF, EPUB `mimetype`, MOBI vs AZW3 via KF8 markers, KFX rejection) with unit tests using small byte fixtures, including a misnamed EPUB
- [x] 4.3 Implement size checks (100 MB per file with exact message, library-total over 1 GB, 50 MB "can take a while" note) with unit tests for the message text
- [x] 4.4 Implement `drm.ts` (EPUB `encryption.xml` algorithm allowlist, `rights.xml`, `sinf.xml`; MOBI encryption field; PDF `EBX_HANDLER`/non-Standard filter and `PasswordException` mapping); verify unit tests with fixtures for DRM EPUB, font-obfuscated EPUB (accepted), encrypted MOBI, and password PDF
- [x] 4.5 Vendor foliate-js at a pinned commit in `vendor/foliate-js` with its LICENSE and add the `pdfjs-dist` dependency, both reachable only through dynamic `import()`; verify `npm run check:size` still passes and the shelf's network log contains no renderer chunks
- [x] 4.6 Implement `metadata.ts` (foliate `makeBook` title/cover/section sizes → page estimate; pdf.js XMP→Info title, `numPages`, page-1 cover render) and `title-clean.ts` (junk-title rejection, filename cleanup); verify unit tests for the cleaning rules and integration tests on public-domain EPUB, MOBI, AZW3, and PDF fixtures
- [x] 4.7 Implement `cover-colors.ts` (48×72 downsample, border trim, OKLab k-means k=5 with fixed seed, dominant + contrast-qualified accent, synthesized fallback accent); verify unit tests on synthetic two-color and monochrome images
- [x] 4.8 Build the preview dialog (native `<dialog>`, live spine preview at shelf height, title field with "Add a title." validation, segmented control "From cover · Frame · Medallion · Arch" with arrow-key tablist, Background/Trim color inputs, "Shuffle colors", "Cancel", "Add to shelf", "Book N of M", focus to title and restore on close); verify Playwright tests for each spec scenario and an axe scan of the open dialog
- [x] 4.9 Implement `queue.ts` (validate all, one `role="alert"` region listing rejections with exact messages, sequential previews, cancel advances) and wire picker + drop (including drops while the reader is open); verify a Playwright test dropping two EPUBs and a DOCX
- [x] 4.10 Implement "Add to shelf": store Blob in cache, add pending op, render spine immediately and scroll it into view, open the connect dialog if not connected, background upload with "Uploading … N%" status, "Not uploaded" + "Retry upload" on failure; verify Playwright tests with the mocked API for success, offline failure, and retry

## 5. Reader

- [x] 5.1 Build the reader view shell: paper surround, top bar (back left, progress center, delete icon button right with `aria-label="Delete book"`), loading state, error state with "Back to shelf", Escape/back returning to the shelf with focus on the book's spine; verify Playwright tests for Escape focus return and the missing-file error
- [x] 5.2 Implement `spread.ts` (page↔spread mapping, page 1 alone on the right in spread mode, single mode) and the spread/single `matchMedia` switch that preserves the current locator; verify unit tests for mapping and a Playwright test resizing between modes
- [x] 5.3 Implement `pdf-reader.ts` (lazy pdf.js, `isEvalSupported:false`, DPR-scaled canvases capped at 2×, adjacent-spread prerender, TextLayer, "12–13 of 240" progress); verify a Playwright test on a fixture PDF for spread layout, page turns, and selectable text
- [x] 5.4 Implement `foliate-reader.ts` adapter (open, goTo, next, prev, relocate events; paginated with `max-column-count` 1/2; injected page/ink styles; no animation; "34%" progress); verify Playwright tests on EPUB, MOBI, and AZW3 fixtures for spread layout, reflow on resize, and page turns
- [x] 5.5 Add navigation inputs: Left/Right keys (including from inside foliate iframes), "Previous page"/"Next page" edge buttons (15% width, ≥ 44 px), pointer-swipe for PDF, boundary no-ops; verify Playwright tests for keys, edge clicks, touch-emulated swipes, and the last-page boundary
- [x] 5.6 Verify the CSP blocks book scripts: add an EPUB fixture with inline and external scripts and assert in Playwright (Chromium, WebKit, Firefox) that the scripts never run and the book renders
- [x] 5.7 Build the delete confirmation dialog ("Delete [title]? This removes the file from your library.", "Delete"/"Cancel"), require connection, call storage delete, return to shelf; verify Playwright tests for confirm, cancel/Escape, and the not-connected prompt

## 6. Reading position persistence

- [x] 6.1 Save the position (`locator`, `fraction`, `label`, `updatedAt`) to IndexedDB on every relocate/page turn, and open each book at `max(local, manifest)` by `updatedAt` with the fraction fallback when a CFI fails; verify a Playwright test that turns to a page, closes the tab, and reopens at that page
- [x] 6.2 Implement `sync.ts` (dirty set; commit one "Update reading positions" manifest change on leaving the reader, on `visibilitychange: hidden`, and at most every 5 minutes; retry unsynced on next load; skip when unconnected); verify unit tests with fake timers and the mocked API asserting a 30-page session produces exactly one commit
- [x] 6.3 Show the ribbon and progress description on the shelf from the effective position (local or synced); verify a Playwright test that reading one page makes the ribbon appear on return
- [x] 6.4 Cross-device check: with the mocked API standing in for GitHub, simulate device A syncing a position and device B (fresh storage, connected) opening the book at that position; verify the Playwright test passes

## 7. Polish and accessibility

- [x] 7.1 Run axe-core across the shelf, preview dialog, connect dialog, reader, and delete dialog; verify zero violations and fix any found
- [ ] 7.2 Manually verify with VoiceOver (macOS and iOS) and NVDA or Firefox that spines announce titles and progress, dialogs trap and return focus, and reader edge buttons are announced; record results in the README testing notes
- [x] 7.3 Verify layout at 320 px, 768 px, 1440 px and at 200% zoom for every view, and that all targets are ≥ 44×44 px; capture Playwright screenshots as baselines
- [ ] 7.4 Run Lighthouse (mobile, 4G throttling) on the deployed shelf with a 30-book fixture library; verify LCP < 2.0 s, CLS < 0.05, INP < 200 ms, and record the scores in the README
- [x] 7.5 Run the styleguide review checklist (token colors only, serif only at display sizes, one primary per view, sentence-case copy, no emoji, reduced motion) and confirm the exemptions list in the README matches what shipped
- [ ] 7.6 End-to-end smoke test on the real deployed site in current Chrome, Safari, and Firefox (desktop) and iOS Safari and Android Chrome: connect, add an EPUB, MOBI, and PDF, read, reopen on a second device at the synced position, delete; verify every step and record results

## Workflow follow-up

- Archive the change with `/opsx:archive` once implementation and review are complete.
