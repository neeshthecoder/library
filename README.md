# The bookshelf

A personal digital library that runs as a static site on GitHub Pages. Books (PDF, EPUB, MOBI, AZW3) sit as spines on one horizontal shelf. Drop a file anywhere to add it, and click a spine to read it in a two-page spread that remembers where you stopped.

There is no server. Book files and a manifest (`library/manifest.json`) live in this repository and are published with the site. Anyone who opens the site can read the shelf without signing in. A device can add or delete books, and sync reading positions, once you paste a GitHub token on it.

## Set up your own copy

1. **Create the repository.** Push this project to a new GitHub repository. On the free plan, Pages needs the repository to be **public**.
2. **Enable Pages.** In the repository, go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
3. **Deploy.** Push to `main`, or run the "Deploy to GitHub Pages" workflow by hand. The site appears at `https://<owner>.github.io/<repo>/` with an empty shelf.
4. **Create a token** for each device that will add books:
   1. Open **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
   2. Under **Expiration**, pick a date. Don't choose "No expiration".
   3. Under **Repository access**, choose **Only select repositories** and pick this repository.
   4. Under **Permissions → Repository permissions**, set **Contents** to **Read and write**. Metadata (read) is added automatically.
   5. Generate the token and copy it.
5. **Connect the device.** On the site, choose **Library settings → Connect**, check the owner and repository name (prefilled from the address), and paste the token. It is stored only in that browser's IndexedDB and sent only to `api.github.com`. Use **Library settings → Disconnect** to remove it.

### What to know before adding books

- **Books are public.** Anyone with the site link can download every file in `library/books/`, and the repository is public too. File names are random, and the page carries a `noindex` tag, but that is not access control. On a project site (`<owner>.github.io/<repo>/`), crawlers ignore `robots.txt`, because they only read it at the domain root. Book files themselves can't carry `noindex`, since Pages can't set headers. To block crawlers from the whole domain, add a `robots.txt` with `Disallow: /` to your `<owner>.github.io` user-site repository. Only add books you are comfortable sharing, and remember that publishing purchased ebooks may breach their license.
- **Deleting doesn't shrink the repository.** A deleted book is removed from the site, but it stays in git history and still counts toward GitHub's roughly 1 GB repository guideline. To purge it for real, rewrite history yourself. For example, run `git filter-repo --path library/books/<id>.<ext> --invert-paths`, then force-push.
- **Limits.** Each file can be up to 100 MB, which is GitHub's hard limit. The shelf shows the live library total against about 1 GB.
- **New books take a minute to reach other devices.** Each add, delete, or position sync is a commit, and the site redeploys in about 1–2 minutes. The device that made the change sees it immediately.
- **Not for DRM files.** DRM-protected books are detected and refused. Kindle KFX files are not supported.

## Develop

```sh
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (Vitest)
npm run test:e2e     # browser tests (Playwright; builds and serves dist/)
npm run build        # type-check and build to dist/
npm run check:size   # fail if the shelf's JavaScript is 150 KB gzipped or more
```

- Run `npx playwright install chromium webkit firefox` once before the browser tests.
- The dev server doesn't apply the Content Security Policy, so scripts inside EPUBs can run there. Only open books you trust in `npm run dev`. The built site blocks them.
- `npm run fonts` re-copies the WOFF2 files from Fontsource after a font upgrade.
- `node scripts/make-fixtures.mjs` regenerates the test books.

### Project layout

| Path | What lives there |
|---|---|
| `src/shelf/` | Shelf view, wheel-to-horizontal scrolling |
| `src/spines/` | Spine art: three parametric trim SVGs, cover-derived spine, palette, contrast, title fitting |
| `src/import/` | Drag overlay, file sniffing, DRM detection, metadata, preview dialog, queue |
| `src/reader/` | Reader view, pdf.js renderer, foliate-js adapter, spread logic |
| `src/storage/` | Manifest model, IndexedDB cache, GitHub Git Data client, sync |
| `vendor/foliate-js/` | Vendored foliate-js at a pinned commit (MIT); see `VENDOR.md` |
| `library/` | The published library: `manifest.json` and `books/` |

pdf.js and foliate-js load only when the reader or the import preview opens, so the shelf stays far under its JavaScript budget.

## Styleguide exemptions

The interface follows `STYLEGUIDE.md`. These deviations are deliberate:

- **Spines and bookmark ribbons are illustrations.** They use colors outside the token palette (cover-derived or randomly generated), ornament, and star motifs (the Medallion trim). They are flat, with rounded corners and no shadows or gradients. A single flat tone band, 3% lighter than the spine color, echoes the reference artwork. Ribbons are darkened when needed so they stay visible (3:1) on the paper background. Spine titles use the trim color when it reaches 4.5:1. Otherwise they use paper or ink, and pure white or black only when neither of those reaches 4.5:1.
- **The shelf plank** is a flat rounded bar in `--ink-muted`. The styleguide forbids hairlines, and the plank is part of the illustration, not a divider.
- **The drag overlay** uses a dashed outline, despite the "no borders" rule, so the drop target reads clearly.
- **Book content** inside the reader keeps the publisher's typography. The serif and type-scale rules apply to interface chrome, not to the books themselves.

## Security notes

- The production build sets a strict Content Security Policy as a `<meta>` tag. Scripts may load only from the site itself, and connections may go only to the site and `api.github.com`. This also stops scripts embedded in EPUBs from running: foliate-js renders book sections in same-origin iframes, and they inherit this policy. That matters because the GitHub token lives on this origin.
- Book titles are inserted with `textContent` or escaped. Book content is never put into the main document.
- GitHub Pages can't send HTTP headers, so `frame-ancestors` (clickjacking protection) can't be set.

## Testing notes

Automated coverage is in `tests/unit` and `tests/e2e`. Manual results (screen readers, real devices, Lighthouse) are recorded below as they are run.

### 2026-11-08: first deploy (https://neeshthecoder.github.io/library/)

- **Deploy:** the GitHub Actions workflow ran unit tests, built the site, passed the budget check, and deployed. Shelf JavaScript: 19.5 KB gzipped (budget 150 KB).
- **Live smoke test:** current Chromium, WebKit, and Firefox (Playwright, desktop). The shelf loads with the CSP meta in place, and fonts and the manifest load under `/library/`. No HTTP or JavaScript errors.
- **Lighthouse 12.6.1** (mobile, simulated 4G, Chrome for Testing):

  | Library | Performance | Accessibility | Best practices | LCP | CLS | TBT |
  |---|---|---|---|---|---|---|
  | Live site, empty shelf | 100 | 100 | 100 | 1.3 s | 0 | 0 ms |
  | Local build, 30-book manifest | 100 | 100 | 100 | 1.4 s | 0 | 0 ms |

  INP can't be measured in a page-load audit. Total blocking time is the lab proxy.
- **Not yet done:** screen-reader passes (VoiceOver on macOS and iOS, NVDA), and testing on real iOS and Android devices.
