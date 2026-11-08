# Design

## Context

- Greenfield repo: only `STYLEGUIDE.md`, `design/shelf-sketch.pdf`, `design/spine-trims.png`, and an empty `openspec/`. Motivation and scope are in proposal.md; behavior is in `specs/*/spec.md`.
- **Hosting is GitHub Pages**: static files only, no server, no request-time code, CDN `Cache-Control: max-age=600`, about 1 GB published-site limit, 10-minute deploy timeout, soft 100 GB/month bandwidth. Free-plan Pages requires a **public repository**, and a Pages site is public even when the repo is private (unless on Enterprise).
- **GitHub limits**: 100 MB hard limit per file (warning at 50 MB), about 1 GB recommended repo size, 5,000 authenticated API requests per hour. Release-asset downloads don't send CORS headers, so a browser can't fetch them.
- **The sketch** shows: a centered "The Bookshelf" headline, one long shelf of upright spines with irregular heights (about 65–100% of shelf height) and widths, flush to the left edge, running off to the right, and the note "Scroll makes animation go left and right."
- **The trims image** shows three dark-teal spines with orange line ornament and faint vertical tone bands. Read as flat line art:
  - **A, "Frame"** (wider, about 1:3.1): nested rectilinear frames, rounded half-pill tabs on both sides at about ¼ and ¾ height, small square corner notches, a tall central panel with scalloped top and bottom, a diamond plus two dots at each end.
  - **B, "Medallion"** (about 1:4.3): a label plate at the top, a circle medallion with a five-point star, a tall arched panel, a quatrefoil lattice block, and a leafy sprig at the foot.
  - **C, "Arch"** (about 1:4.3): semicircular caps top and bottom, each with a fleuron (split acanthus), an ogee-arched tall panel, and four four-point sparkles flanking the panel ends.

## Goals / Non-Goals

**Goals:**
- Shelf route stays under 150 KB gzipped JS; renderers load only on demand.
- One storage model that works on every device with no backend the user has to run.
- Every module that can be pure (color math, palette generation, manifest operations, signature and DRM sniffing, title cleanup, drag counter, spine geometry) is pure and unit-tested.

**Non-Goals:**
- Offline-first PWA and service worker. The IndexedDB cache gives fast reopening, but full offline shell support is not a goal.
- Purging deleted books from git history (documented, not automated).
- Text search, TOC navigation UI, font-size controls. The reader is deliberately bare.
- Client-side encryption of books (proposed follow-up, see Risks).

## Decisions

### 1. Stack: Vite + vanilla TypeScript, no UI framework

The whole UI is two views and two dialogs. A tiny hand-rolled pattern is enough: modules that render into DOM nodes, plus a small observable store (`src/state/store.ts`, about 40 lines) holding manifest, local overlay, and connection state. Native `<dialog>` handles modals: focus trapping, Escape, and `::backdrop`.

- *Alternatives:* Preact (about 4 KB) would be fine but adds JSX tooling for little gain. Lit is good for web components, but foliate-js already uses custom elements and we don't need more. Svelte adds compile tooling. All of them fit the budget; vanilla wins on simplicity and matches "no large frameworks".
- Dependencies: `pdfjs-dist` (lazy), foliate-js (vendored, lazy), `idb` (about 1 KB). Dev: `vitest`, `@playwright/test`, `fontaine` (fallback font metrics), `size-limit` or a small gzip-size script for the budget gate.

**Module layout**

```
src/
  main.ts                 router + boot
  router.ts               hash routes
  styles/                 tokens.css, base.css, components.css
  shelf/                  shelf-view.ts, wheel-scroll.ts, shelf-layout.ts
  spines/                 spine.ts (render), trims/{frame,medallion,arch}.ts,
                          palette.ts, contrast.ts, cover-colors.ts, title-fit.ts, geometry.ts
  import/                 drag-overlay.ts, sniff.ts, drm.ts, metadata.ts,
                          preview-dialog.ts, queue.ts, title-clean.ts
  reader/                 reader-view.ts, pdf-reader.ts, foliate-reader.ts, spread.ts
  storage/                manifest.ts (types + pure ops), github.ts, cache.ts,
                          positions.ts, connect-dialog.ts, sync.ts
vendor/foliate-js/        pinned commit + LICENSE
library/manifest.json     seed: {"version":1,"books":[]}
library/books/            book files
```

### 2. Storage: book files and manifest in the Pages repo (recommended), with an IndexedDB cache

**Data model** (`library/manifest.json`):

```json
{
  "version": 1,
  "updatedAt": "2026-11-07T20:00:00Z",
  "books": [{
    "id": "k3f9x2m7qp",
    "title": "Middlemarch",
    "format": "epub",
    "file": "library/books/k3f9x2m7qp.epub",
    "size": 1843200,
    "addedAt": "2026-11-07T19:58:12Z",
    "length": { "pages": 880, "estimated": true },
    "cover": { "dominant": "#24413a", "accent": "#e07a3f" },
    "spine": { "source": "trim", "design": "arch", "bg": "#24413a", "trim": "#e07a3f",
               "ink": "#f4efe6", "h": 0.91, "w": 0.18 },
    "position": { "locator": "epubcfi(/6/14!/4/2/1:0)", "fraction": 0.34,
                  "label": "34%", "updatedAt": "2026-11-07T21:10:00Z" }
  }]
}
```

- `id` is 10 random base32 characters (about 50 bits) from `crypto.getRandomValues`. It also names the file, so paths can't be guessed from titles.
- `locator` is the PDF page number as a string, or the EPUB CFI from foliate for EPUB, MOBI, and AZW3. foliate synthesizes CFIs for MOBI/KF8. `fraction` is the fallback if a CFI fails to resolve.
- Pure functions in `manifest.ts`, all unit-tested: `addBook(m, entry)`, `removeBook(m, id)`, `setPosition(m, id, pos)` (newer `updatedAt` wins), `merge(remote, localOps)`.

**Reads (no token):** `fetch(BASE + 'library/manifest.json?t=' + Date.now(), {cache:'no-store'})` from the Pages origin. Book files come from `BASE + book.file`. The query string bypasses the CDN's 10-minute cache.

**Reads (connected):** fetch the manifest through `GET /repos/{o}/{r}/contents/library/manifest.json` with `Accept: application/vnd.github.raw+json`, so a connected device sees its latest commit before Pages redeploys. If a book file isn't on Pages yet and isn't cached, fall back to `GET /repos/{o}/{r}/git/blobs/{sha}` using the blob SHA from the tree.

**Writes:** use the Git Data API so each operation is one atomic commit with the file and manifest together. The Contents API needs one commit per file and handles large files poorly.

1. `GET /git/ref/heads/{branch}` → head commit SHA → its tree SHA.
2. `POST /git/blobs` with the book as base64 (sent with `XMLHttpRequest` so upload progress shows). Base64 encoding runs in chunks so a 100 MB file doesn't block the main thread for long. Use `Uint8Array.prototype.toBase64` where available, with a chunked `btoa` fallback.
3. Fetch the current manifest at that head, apply the pure op, `POST /git/blobs` the new manifest.
4. `POST /git/trees` with `base_tree` and the two entries (or for delete, the file entry with `sha: null`).
5. `POST /git/commits`, then `PATCH /git/refs/heads/{branch}` with `force: false`.
6. **Conflict** (422, not fast-forward): re-read the head, re-apply the *operation* (not the manifest snapshot) to the newer manifest, and retry up to 3 times. The already-uploaded book blob is reused. This satisfies "concurrent edits don't lose either change".

Commit messages: `Add "Middlemarch"`, `Delete "Middlemarch"`, `Update reading positions`.

**Local overlay:** IndexedDB (`idb`) stores:
- `files` (id → Blob, lastOpenedAt)
- `positions` (id → position)
- `pending` (ops not yet confirmed on Pages: `{op, book, commitSha, state: 'uploading'|'committed'|'failed'}`)
- `settings` (token, owner, repo, branch)

The effective shelf is `merge(publishedManifest, pending)`. A pending op is dropped once the published (or API-read) manifest reflects it. A `failed` op shows "Not uploaded" with "Retry upload". `navigator.storage.persist()` is requested on first add. On `QuotaExceededError`, evict the least recently opened files and retry.

- *Why IndexedDB and not OPFS for the cache:* IndexedDB stores Blobs well in all three browsers, and OPFS's synchronous access is worker-only, with Safari quirks. OPFS adds nothing for whole-file reads.

**Token handling:** fine-grained PAT scoped to *this one repo*, permission **Contents: Read and write** (Metadata: read is implied). It is stored in IndexedDB `settings`, never in the repo, and sent only to `api.github.com`. Owner and repo are prefilled from `location` (`<owner>.github.io/<repo>`). The connect dialog verifies with `GET /repos/{o}/{r}` and checks `permissions.push`. "Library settings" (a fine-text link next to the size readout) offers Disconnect.

**Reading-position sync:** every page turn writes to IndexedDB `positions` (cheap, synchronous-feeling). On a connected device, `sync.ts` collects dirty positions and commits one manifest update when:
- the user leaves the reader (route change),
- `visibilitychange → hidden` (`fetch` with `keepalive` can't carry a multi-step Git flow, so this is best-effort; anything that doesn't finish retries on next load),
- or 5 minutes have passed since the last sync while reading.

Merge rule: per book, newest `updatedAt` wins. On open, the reader takes `max(local, manifest)`.

**Size accounting:** sum `book.size` from the manifest for the readout. Block at 100 MB per file, and block any add that would push the total over 1 GB. Warn in the readout over 800 MB. The readout is honest that git history can be larger than the live total.

**CI cost of a commit per change:** each add, delete, or position sync triggers a Pages build, about 1 minute. The workflow uses `concurrency: {group: pages, cancel-in-progress: true}` and an npm cache. Position syncs are already debounced, so a reading session costs one deploy. Public repos get unlimited Actions minutes.

**Alternatives compared:**

| | Repo + Pages (chosen) | IndexedDB only | Release assets | Git LFS | Third-party storage (S3, Drive) |
|---|---|---|---|---|---|
| Visible on every device | Yes | No, single browser profile | — | — | Yes |
| Survives clearing site data | Yes | No, and Safari can evict after 7 days without a visit unless installed or persisted | — | — | Yes |
| Read without credentials | Yes | n/a | Blocked by CORS | Pages serves pointer files unless the workflow checks out LFS; browser upload via the LFS batch API isn't CORS-friendly | Needs signed URLs or a public bucket |
| Needs a token or account | PAT per writing device | None | — | — | Separate cloud account and keys |
| Privacy | Public | Private to the device | — | — | Can be private |
| Deletes free space | No, history keeps blobs | Yes | — | — | Yes |
| Latency for new books on other devices | About 1–2 min (deploy) | n/a | — | — | Instant |

IndexedDB-only is simpler: no token, private, no limits beyond quota. But it fails the core requirement ("from any device", "permanent"). Repo + Pages is the only option that is free, static, credential-free to read, and needs no service besides GitHub. Release assets and LFS are rejected for browser CORS reasons. Third-party storage is out of scope; it adds an account and a second set of secrets.

### 3. Format rendering: native, no conversion

**No conversion to PDF.** Rendering EPUB/MOBI to PDF in the browser would mean laying out HTML into fixed pages (via an HTML-to-canvas path or a PDF library). That throws away reflow, so text can't adapt to phone versus desktop, and it bloats files and repo size. It also costs seconds of CPU per book. foliate-js already paginates reflowable books natively into multi-column spreads, so conversion buys nothing.

**PDF: `pdfjs-dist`**, dynamically imported, worker loaded via `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`, `isEvalSupported: false`.
- `spread.ts` (pure) maps a page to a spread. In spread mode, page 1 sits alone on the right, then pairs (2,3), (4,5), and so on. Single mode is one page.
- Each visible page renders to a `<canvas>` scaled to fit the available height and half-width at `devicePixelRatio`, capped at 2× on huge viewports for memory. Adjacent spreads pre-render into offscreen canvases for instant turns.
- A pdf.js `TextLayer` goes over each canvas so screen readers and text selection work.
- Password and DRM: `PasswordException` → password message. An `/Encrypt` dictionary with `/Filter /EBX_HANDLER` or another non-Standard filter → DRM message. Owner-password-only PDFs (permissions restrictions) open normally.

**EPUB, MOBI, AZW3: foliate-js**, vendored at a pinned commit under `vendor/foliate-js` with its MIT license. It isn't published on npm in a maintained form, and pinning protects against upstream API churn. It loads via dynamic `import()` of `view.js`, which registers `<foliate-view>`.
- Paginated layout with `max-column-count` set to 2 in spread mode and 1 in single mode. Gap and margins come from spacing tokens. `relocate` events provide `cfi`, `fraction`, and the section, and feed both progress and position saving.
- Reader styles injected into book content: page background `--on-dark` (#FFFFFF) on a `--paper` surround, text color `--ink`. The publisher's fonts are respected, falling back to the book's own CSS. Book content is content, not chrome, so the serif-size rule doesn't apply inside books (noted as an exemption).
- **Script safety:** foliate renders sections in same-origin iframes from `blob:` URLs. Per CSP, local-scheme documents inherit the creator's policy, so the site's `script-src 'self'` (no `blob:`, no `'unsafe-inline'`) blocks EPUB scripts. This matters because the GitHub token lives on this origin. Verified by an e2e test with a script-bearing fixture in all three browsers.
- Swipe: foliate's paginator handles touch inside iframes. For PDF we use pointer events on the page container (40 px horizontal threshold, ignore when vertical movement dominates).

**Spread vs. single:** spread when `(min-width: 48rem) and (orientation: landscape)` matches. A `matchMedia` listener switches mode and keeps the current locator.

**Navigation:** keydown (`ArrowLeft`, `ArrowRight`, `Escape`) on `document` while in the reader. foliate forwards key events from its iframes. Edge zones are two transparent `<button>`s ("Previous page" / "Next page"), each 15% of the width and at least 44 px, overlaid on the outer edges. Page change is an instant swap. A 150 ms opacity crossfade is permitted but off by default; we use the instant swap for PDF and foliate's no-animation mode.

### 4. Import pipeline

`drag-overlay.ts`: a window-level counter. Increment on `dragenter`, decrement on `dragleave`, show when the count is above 0, but only if `e.dataTransfer.types.includes('Files')`. `dragover` calls `preventDefault()` (required to allow drop). Reset to 0 and hide on `drop` and `dragend`. A watchdog also hides the overlay if no `dragover` arrives for 150 ms: Safari and Firefox occasionally skip a `dragleave` when the pointer exits fast, which makes naive counters stick. The counter logic is a pure reducer and unit-tested.

Overlay: fixed, `inset: 0`, `--paper` at 92% opacity (this is an opacity, not a new color). It has an inner box inset `1rem` with a `2px dashed var(--ink-muted)` outline and `--radius-card`, and the text "Drag file here" in sans `heading`. *Note:* "Drop file here" reads slightly more accurately during a drag; the requested copy is kept and is a one-string change.

Pipeline per file, in `queue.ts`:
1. **Sniff** (`sniff.ts`, first 64 bytes):
   - `%PDF-` → pdf.
   - `PK\x03\x04` with first entry `mimetype` = `application/epub+zip` → epub.
   - Bytes 60–67 `BOOKMOBI` → MOBI, split into `mobi` or `azw3` by the presence of a KF8 boundary (EXTH 121 or file version 8).
   - `TPZ`/KFX containers → unsupported ("Kindle KFX files aren't supported").
   - Otherwise reject.
2. **Size check**: per-file and library-total checks, before parsing.
3. **DRM** (`drm.ts`):
   - EPUB: read `META-INF/encryption.xml`. DRM if any `EncryptedData` uses an algorithm other than the IDPF (`http://www.idpf.org/2008/embedding`) or Adobe (`http://ns.adobe.com/pdf/enc#RC`) font-obfuscation algorithms. Also DRM if `META-INF/rights.xml` (Adobe ADEPT) or `META-INF/sinf.xml` (Apple FairPlay) exists.
   - MOBI/AZW3: the PalmDOC header encryption field (record 0, offset 12) is non-zero.
   - PDF: checked when pdf.js opens it (step 4).
4. **Metadata and cover** (lazy-loads the relevant renderer module):
   - EPUB/MOBI/AZW3 via foliate's `makeBook` → `metadata.title`, `getCover()`, and section sizes for a length estimate (about 1,800 characters per page).
   - PDF via pdf.js `getMetadata()` → XMP `dc:title`, else Info `Title`. `numPages` gives length. Page 1 renders to a 200 px tall canvas as the cover.
5. **Title** (`title-clean.ts`): reject metadata titles that are empty, `untitled`, match `^Microsoft (Word|PowerPoint) - `, end in a file extension, or look like a path or UUID. Fall back to the filename: strip the extension and ` (n)` copy suffixes, turn `_`, `-`, and `.` into spaces, collapse whitespace, and use sentence case only if the name was all lower or upper case.
6. **Preview dialog** (`preview-dialog.ts`, native `<dialog>`):
   - Layout: spine preview on the left at real shelf height (the same `renderSpine` used by the shelf); on the right, the title input (linen), a segmented control "From cover · Frame · Medallion · Arch", and two `<input type="color">` fields labeled "Background" and "Trim" (shown for trims), next to a secondary "Shuffle colors" button. The footer has secondary "Cancel" and primary "Add to shelf".
   - Queue position appears as fine text: "Book 1 of 3".
   - On narrow screens the preview stacks above the controls and scales down proportionally.
7. **Add**: write the Blob to the IndexedDB `files` store, add a `pending` op, and the shelf updates immediately and scrolls to the new spine. Upload runs in the background (step 2 of the storage flow) with a small fine-text status under the shelf, "Uploading Middlemarch… 42%". If not connected, the connect dialog opens first.

Rejected files are reported together in one `role="alert"` message region beneath the headline, with one line per file.

### 5. Spine inference from covers (what's realistically inferable)

Ebook files almost never contain spine artwork. EPUB and MOBI ship a front cover only, and a PDF's page 1 is a front cover at best. So we infer **colors**, not art:

- `cover-colors.ts`:
  1. Draw the cover into a 48×72 canvas (`createImageBitmap` + `OffscreenCanvas` where available).
  2. Drop near-transparent pixels and the outer 4% border, which is often white margin on PDFs.
  3. Convert to OKLab and run k-means with k=5 over at most 3,456 pixels (fast, deterministic seed).
  4. **Dominant** is the largest cluster.
  5. **Accent** is the cluster that maximizes `chromaDistance × log(size)` among clusters with at least 3:1 contrast against the dominant color. If none qualify, synthesize one by rotating the dominant hue 180° and adjusting lightness until it reaches 3:1.
- Cover spine rendering: flat background = dominant, two accent bands (one near the top, one near the bottom, `0.05h` thick, inset `0.06h` from the ends), title panel between them, and the ribbon in the accent color.
- **Vertical crop rejected as the default**: a strip from a cover is usually a sliver of the title text or the illustration's edge, and it reads as noise at 44–70 px wide. It would also need a stored image per book (repo weight, CLS considerations). Colors-only is honest and consistent. The cover is only used at import time; only the two colors are stored.

### 6. Trim SVGs: parametric three-part construction

Stretching one fixed SVG with `preserveAspectRatio="none"` would distort the circles, stars, and diamonds. Instead each trim is a TypeScript function `renderTrim(design, {w, h, bg, trim})` that returns an SVG string:

- **Coordinate system:** viewBox width fixed at 100 units, height `100 × h/w`. Every ornament is drawn in this unit space, so it scales uniformly with spine width.
- **Three parts:**
  - a **head cap** of fixed unit height (Frame 70, Medallion 95, Arch 80) drawn at the top,
  - a **foot cap** drawn at the bottom (mirrored head for Frame and Arch, lattice plus sprig for Medallion),
  - a **middle panel** whose rectangle or arch path is computed from the remaining height.
- The title occupies the middle panel's inner box, which the function returns as `{x, y, width, height}` in unit space so the title layer can be positioned. The minimum spine aspect is guaranteed so the middle panel never falls below 40% of the height.
- **Stroke and fill:** all ornament lines use `stroke="var(--trim)"`, stroke-width 2.2 units, round caps and joins, `fill="none"`. Solid motifs (star, diamonds, sparkles, fleurons) use `fill="var(--trim)"`. The body is a `rect` with `rx` 6 units and `fill="var(--bg)"`. `--bg` and `--trim` are set as inline custom properties on the spine element, so recoloring is a style change with no re-render.
- **Tone bands:** the reference has faint vertical tonal bands. To stay flat (no gradients), we render one optional flat band at 6% lighter than `--bg`, covering the middle third. It's computed in OKLCH and is part of the illustration exemption. Easy to drop if it reads as texture.
- **Fidelity:** each design is hand-drawn as paths traced against `design/spine-trims.png`, simplified to about 30–60 path segments per cap and kept cartoony (rounded joins, fewer nested lines than the reference where they'd crowd a 44 px spine). At widths under about 56 px, the Frame design drops its innermost frame line (a `data-detail="low"` variant) to avoid moiré.
- **Wide vs narrow:** Frame's native aspect is wider. The geometry module biases Frame toward the wider end of the width range when it's picked at random.
- A Vitest snapshot per design at three sizes, plus a Playwright visual check in the import preview, keeps them stable.

**Random harmonious palette** (`palette.ts`, OKLCH, gamut-clamped to sRGB):
1. Pick a background hue uniformly, and a mode: dark (L 0.24–0.40, C 0.04–0.10; about 75% of picks, matching the reference's mood) or light (L 0.84–0.92, C 0.03–0.08).
2. Trim hue = background hue + one of {150°–210° (complementary), ±30° (analogous)}, C 0.10–0.17. Lightness is solved by bisection to reach at least 3.5:1 contrast with the background (margin over the 3:1 requirement).
3. Retry with a new seed if gamut clipping drops contrast below 3:1 (bounded at 20 tries, then a fixed known-good pair).
- **Title ink** (`contrast.ts`): if the trim color meets 4.5:1 against the background, the title uses the trim color (it matches the reference look). Otherwise it uses the higher-contrast of `#F8F6F1` (paper) and `#232C32` (ink). One of these always reaches at least 4.5:1 against any background, since `max(contrast vs white, contrast vs black)` is at least 4.58 for any color, and paper and ink are close to those extremes. A unit test sweeps the sRGB cube coarsely to prove the guarantee holds for paper and ink.

### 7. Spine geometry and title fit

- **Shelf height:** `clamp(14rem, 42vh, 24rem)`. Spines size in shelf units so the whole shelf scales.
- **Height:** `h = 0.74 + 0.24 × hash01(id)`, giving 74–98% of shelf height. Deterministic and stored in the manifest so it never drifts.
- **Width:** from length, `pages → 0.13 + 0.07 × clamp(log10(pages/50)/log10(20), 0, 1)` of shelf height, plus ±0.01 jitter from the hash, then clamped to at least 44 px at render time (touch target).
- **Ribbon:** an SVG notch-tailed ribbon, width 0.28w, peeking 0.6rem above the spine top, positioned at 70% of the spine width. Its color is the spine's trim or accent color.
- **Title fit** (`title-fit.ts`, pure apart from an injected `measure(text, size)`):
  - Measuring uses a cached `CanvasRenderingContext2D.measureText` with Inter 500, after `document.fonts.ready` (no DOM layout thrash across many spines).
  - Size search runs from `min(panelInnerWidth × 0.62, 20px)` down to 11px in 0.5px steps. Pass 1 tries a single line; pass 2 tries two balanced lines (only when the panel is wide enough for two lines at 11px or more); pass 3 truncates at the minimum size with an ellipsis via binary search on characters, word-boundary preferred.
  - The title renders as an HTML `<span>` over the SVG (not SVG `<text>`), with `writing-mode: vertical-rl`, so it reads top to bottom (English publishing convention; the sketch is ambiguous, and flipping is one CSS line), with `font-feature-settings` default and `--title-ink` color.
  - Results are cached per (title, panel size). Refitting runs on shelf-height change via `ResizeObserver`.

### 8. Shelf layout and scrolling

- Markup: `<main>` → `<h1>` → `<section aria-label="Shelf">` containing a horizontally scrollable `<ul>` of `<li><button class="spine">`, followed by a `.shelf-bar` element sized to `scrollWidth of books + 1.5rem`. The bar is flat, `0.5rem` tall, rounded, `--ink-muted` (illustration exemption: the styleguide has no "shelf" and forbids hairlines, but a shelf needs a visible plank).
- Spines align to the bar with `align-items: flex-end`, and gaps vary from 0 to 0.25rem from the hash for the hand-placed look. Left padding matches the body gutter (at least 1rem), so the shelf is "flush left" within the safe gutter while still bleeding off the right edge.
- `wheel-scroll.ts`: a non-passive `wheel` listener. When `|deltaY| > |deltaX|`, convert `deltaY` (normalized for `deltaMode` lines and pages) into `scrollLeft +=` and `preventDefault()`, but only if the shelf can still move in that direction. Otherwise let the page scroll (spec: "Wheel at the end of the shelf"). Native horizontal trackpad and touch scrolling are untouched. `scroll-behavior` is not smooth, for direct manipulation. The sketch's "scroll makes animation go left and right" is satisfied by the direct horizontal motion.
- Scrollbar: `scrollbar-width: thin; scrollbar-color: var(--ink-muted) transparent` (Firefox) and an equivalent thin WebKit style. It's hidden only on fine pointers when not hovered. It is never fully removed, because keyboard and mouse users without trackpads still need a cue.
- Keyboard: roving tabindex across spines (one tab stop). Left and Right move focus, Home and End jump to the ends, and `scrollIntoView({inline:'nearest', block:'nearest'})` keeps the focused spine visible.
- Hover and focus lift: `transform: translateY(-0.5rem)`, `transition: transform 150ms cubic-bezier(0.2,0,0,1)`, disabled under `prefers-reduced-motion`.
- **Order:** oldest left to newest right (the user's default, and the natural "add to the end of the shelf" metaphor). On load the shelf starts at the left. After an add it scrolls the new spine into view, so the newest book is never hidden. I considered "newest at left" (always visible on load), but it makes the shelf reshuffle every time a book is added, which feels less like a real shelf. Scroll position is restored from `sessionStorage` when returning from the reader.
- **Readout and controls row** under the shelf, left-aligned: secondary pill "Add book", then fine text "12 books · 184 MB of about 1 GB · Library settings".

### 9. Site shell, fonts, CSP, deploy

- **Fonts:**
  - Instrument Serif 400 and Inter variable (wght 400–600), Latin-subset WOFF2 copied from `@fontsource/instrument-serif` and `@fontsource-variable/inter` into `public/fonts/`.
  - Hand-written `@font-face` with `font-display: swap`. `<link rel="preload" as="font" type="font/woff2" crossorigin>` for the serif only.
  - Fallback faces (`"Instrument Serif Fallback"` from local Times New Roman, `"Inter Fallback"` from local Arial) use `size-adjust`, `ascent-override`, `descent-override`, and `line-gap-override` computed by `fontaine` at build time.
- **CSP** (meta tag, since Pages can't set headers):
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self' https://api.github.com; worker-src 'self' blob:; frame-src blob:; child-src blob:; object-src 'none'; base-uri 'self'; form-action 'none'`
  - `style-src 'unsafe-inline'` is needed for foliate's injected styles and inline custom properties. `frame-ancestors` can't be set by meta (a known limitation of static hosting).
- **No-index:** `<meta name="robots" content="noindex, nofollow">` and `public/robots.txt` with `Disallow: /`.
- **Vite config:** `base` comes from `process.env.BASE_PATH` (set by the workflow to `/<repo>/`; `/` for user sites). `build.target: 'es2022'`. Manual chunks keep `pdfjs-dist` and `vendor/foliate-js` out of the entry graph. In dev, Vite serves `/library/` from the project root.
- **Workflow** `.github/workflows/deploy.yml`:
  - Triggers: `on: push: branches: [main]` and `workflow_dispatch`.
  - Permissions: `contents: read, pages: write, id-token: write`. Concurrency: group `pages`, `cancel-in-progress: true`.
  - **build** job: `actions/checkout@v4`, `actions/setup-node@v4` (Node 22, npm cache), `npm ci`, `npm test`, `npm run build`, `npm run check:size` (fails over 150 KB gzipped for the shelf entry), `cp -r library dist/library`, `actions/upload-pages-artifact@v3` with `dist`.
  - **deploy** job: `actions/deploy-pages@v4`.
  - Library-only commits skip `npm test` via a paths filter step, so book adds deploy faster.
- **Budget check** script: parse Vite's manifest, gzip the entry plus its static imports, and assert under 150 KB. Expected size is about 25–40 KB.

## Risks / Trade-offs

- **[Books are public]** Anyone with the site URL can list the manifest and download every file, and the repo itself is public on the free plan.
  → For v1: random file ids, `noindex` and `robots.txt`, and a clear notice in the connect dialog.
  → **Recommended follow-up:** opt-in client-side encryption. Derive a key from a passphrase with PBKDF2 or Argon2 via WebCrypto, store books and the manifest as AES-GCM ciphertext, and keep only a salt and a verifier in the clear. Readers enter the passphrase once per device. Costs: no cross-device reading without the passphrase, slower opens, and the shelf can't render before unlocking. Not in v1 because it changes the "visible without a token" behavior.
  → Alternative for paid plans: a private repo with Pages access control (Enterprise) or a private repo read through the API with a read-only token.
  → Hosting copyrighted purchases publicly may breach their license. The notice says so, and the user decides what to add.
- **[Deleted books stay in git history]** Repo size only grows. → Documented in the connect notice and README. The readout shows the live total. A manual purge (`git filter-repo` plus a force push) is documented in the README, not automated.
- **[Token on the device can be stolen through XSS]** → Strict CSP (no inline or blob scripts, no third-party origins), no `innerHTML` with book-derived strings (titles go through `textContent`), and the token is scoped to one repo with Contents permission only. Users are told to set an expiry.
- **[Deploy latency (1–2 min) before other devices see changes]** → The local overlay makes the writing device instant. Connected devices read through the API. Unconnected devices simply see it after the deploy.
- **[Position sync on `visibilitychange` may not complete when a mobile tab is killed]** → The local save is authoritative on that device. Unsynced dirty positions retry on the next load or sync. Worst case another device opens a few pages back.
- **[Large uploads (up to 100 MB to about 133 MB base64) strain memory on phones]** → Chunked base64, XHR progress, and a recommendation in the size-limit copy. Files over 50 MB show "Large files can take a while to upload."
- **[foliate-js is pre-1.0 with an evolving API]** → Vendored at a pinned commit behind our own `foliate-reader.ts` adapter (open, goTo, next, prev, on relocate), so swapping or upgrading is local.
- **[MOBI/AZW3 edge cases (old PalmDOC-only MOBIs, odd encodings)]** → foliate covers KF6 and KF8. Parse failures show the plain "couldn't open this file" error rather than hanging. AZW3 is supported because it's the same parser; KFX is explicitly rejected.
- **[CLS from title fitting after fonts load]** → Spines have fixed box sizes from the manifest before fonts load. Only text inside a fixed box changes, which causes no layout shift.
- **[Pages "not a file host" acceptable-use clause]** → This is a personal, low-traffic library, and bandwidth stays far below the soft limits. Noted in the README.
- **[Styleguide deviations]** → Spines, ribbons, and the shelf plank are illustrations (off-palette colors, ornament, stars). The dashed overlay outline breaks "no borders". Book content inside the reader keeps the publisher's typography. All are listed in the README "Styleguide exemptions" section.

## Migration Plan

Greenfield, so there's no data migration.
1. Enable Pages with source "GitHub Actions" in the repo settings.
2. Push. The workflow deploys an empty shelf.
3. Create a fine-grained PAT (this repo only, Contents read/write, with expiry) and connect it from the site on each device that will add books.

Rollback: revert the commit, or redeploy an earlier run. Library data is plain files in git, so any book or manifest state can be restored from history.

Manifest `version: 1` allows future migrations (for example, encryption). The loader rejects unknown major versions with a plain message instead of misreading them.

## Open Questions

- Should the tonal band on trim spines stay? It's purely visual and can be decided during polish.
- Exact cap heights and stroke weight per trim will be tuned visually against the reference during implementation. This doesn't change the approach.
