# Proposal

## Why

My ebooks (PDF, EPUB, MOBI) are scattered across folders and apps that each remember position differently and look nothing like a bookshelf. I want one calm, personal library I can open from any device: a single page of spines on a shelf, a drop-to-add flow, and a two-page reader that remembers where I stopped. It has to run as a static GitHub Pages site, so there is no server to lean on for storage or sync.

## What Changes

The repo is greenfield today (only `STYLEGUIDE.md`, `design/shelf-sketch.pdf`, `design/spine-trims.png`). This change builds the whole application:

- **Static site shell**: Vite with vanilla TypeScript, hash routing (`#/` shelf, `#/read/<id>` reader), self-hosted Instrument Serif and Inter as WOFF2 with metric-matched fallbacks, styleguide tokens as CSS custom properties, a strict Content Security Policy, and a GitHub Actions workflow that builds and deploys to Pages.
- **Bookshelf view**: the centered serif headline "The bookshelf.", one continuous horizontal shelf of upright spines with stable, slightly varied heights and widths, vertical wheel mapped to horizontal scroll, arrow-key and swipe support, hover/focus lift, ribbon bookmarks on started books, an empty state, a quiet library-size readout, and an "Add book" button.
- **Spine generation**: spines derived from the book's embedded cover (dominant and accent colors), falling back to one of three ornamental trims recreated from `design/spine-trims.png` as parametric inline SVG with random, harmonious, high-contrast colors. Vertical sans titles auto-fit inside the middle panel and always meet WCAG AA contrast.
- **Book import**: a whole-window drag overlay ("Drag file here") with a flicker-proof enter/leave counter, click-to-upload, file-type and size validation, DRM and password detection with plain messages, metadata title extraction, and a queued preview dialog with a live spine preview, editable title, and spine source and color controls.
- **Reader**: native rendering (pdf.js for PDF; foliate-js for EPUB, MOBI, AZW3) in a two-page spread that collapses to one page on narrow screens, keyboard, edge-tap and swipe navigation without page-turn animation, a progress readout, Escape to return, and delete with a confirmation dialog.
- **Library storage**: book files and a JSON manifest live in the Pages repo itself, written from the browser through the GitHub Git Data API with a fine-grained token stored only on the device. Anyone opening the site reads the manifest and files from Pages without a token. Files are cached in IndexedDB for instant reopening. Reading position saves locally on every page turn and syncs to the manifest on a debounce.
- **Documented styleguide deviations**: spines and the shelf are illustrations exempt from the palette, "no ornament" and "no stars" rules, and the drag overlay uses a dashed outline.

No EPUB/MOBI-to-PDF conversion is planned; each format renders natively (justified in design.md).

## Capabilities

### New Capabilities
- `site-shell`: Static build, Pages deployment workflow, routing, fonts, design tokens, Content Security Policy, and performance budgets shared by every view.
- `bookshelf`: The main shelf view: layout, scrolling, spine interaction, bookmarks, empty state, library-size readout.
- `book-spines`: How a book's spine looks: cover-derived colors, the three parametric trim designs, color generation, title fitting and contrast, stable dimensions.
- `book-import`: Adding books: drag-and-drop and file picker, validation, DRM detection, metadata extraction, the preview dialog, and the multi-file queue.
- `book-reader`: Reading a book: two-page spread and single-page fallback, navigation, progress, returning to the shelf, deleting a book.
- `library-storage`: Persistence: the repo-backed manifest and files, GitHub connection and token handling, local cache, reading-position save and sync, size limits.

### Modified Capabilities
- None. There are no existing specs.

## Impact

- **New code**: the entire app (`index.html`, `src/**`, `public/fonts/**`), seed library (`library/manifest.json`, `library/books/`), `.github/workflows/deploy.yml`, test suites.
- **Dependencies**: `vite`, `typescript`, `pdfjs-dist` (lazy-loaded), foliate-js vendored at a pinned commit (MIT, lazy-loaded), `idb` (tiny IndexedDB wrapper), `vitest` and `@playwright/test` for testing. Font files from Fontsource (OFL).
- **External systems**: GitHub REST and Git Data APIs (`api.github.com`) for writes. GitHub Pages for hosting, which means **book files are publicly downloadable** by anyone with the URL (mitigations in design.md). Each library change is a commit that triggers a Pages redeploy.
- **Limits**: 100 MB per file (GitHub hard limit), about 1 GB for the published site and repo. Deleted books remain in git history and keep counting toward repo size.
- **Out of scope**: accounts and multi-user, search, highlights and annotations, collections and sorting UI, page-flip animations, client-side encryption (proposed as a follow-up).
