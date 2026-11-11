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
5. **Sign in on the device.** On the site, choose **Sign in** at the bottom of the page, check the owner and repository name (prefilled from the address), and paste the token. It is stored only in that browser's IndexedDB and sent only to `api.github.com`. Use **Library settings → Disconnect** to remove it.

### Owner and guests

- **Owner:** any device you've signed in on with your token. It can add, delete, and sync your reading positions.
- **Guests:** every other device. Guests can browse the shelf and read any book, but:
  - There's no "Add book" link, no drag-and-drop, and no delete control. A small "Sign in" link replaces them.
  - Nothing is stored on their device: no book copies and no reading positions. Leftovers from earlier visits are wiped. A guest's place in a book lasts only while their tab is open.
  - Books open at the beginning for guests, not at your bookmark. Your bookmark ribbons still show on the shelf, and nothing a guest does can change them.
- **Sign-in is locked** to this site's own repository. Even with sign-in in place, writing to the library still needs a token with write access to your repo, which only you can create.
- **Disconnecting** a device (Library settings → Disconnect) syncs your place, then removes the token, cached books, and positions. It refuses while a book is still waiting to upload.

### Adding and editing books

Drop a file anywhere on the page (or use **Add book**) to open the preview. Besides the title and colors you can set:

- **Author** (optional). It's filled in from the file when the file names one, and shows in smaller text under the title on the spine.
- **Font** for the spine's title and author. Instrument Serif is the default. The others are free stand-ins for classic book faces: EB Garamond (Garamond), Cardo (Bembo), TeX Gyre Pagella (Palatino), Cormorant Garamond (Sabon) and Crimson Pro (Minion).

To change a book that's already on the shelf, as the owner:

- **Mouse:** right-click its spine and choose **Edit**.
- **Keyboard:** focus the spine and press Shift+F10 (or the context-menu key).
- **Touch:** press and hold the spine, then lift your finger without moving it. (Holding and then dragging still moves the book to Finished.)

Edit opens the same dialog with the book's current title, author, font and colors. **Save** records the change as one small commit. The book's file, size, reading position and section stay as they are. Guests don't get the menu. The reading leaderboard keeps the title a reader checked in with, so after a rename it shows the old title until their next check-in on that book.

### Finished books

The far right of the bookcase holds your **Finished** books, behind a bookend lamp, with "Finished" carved into the shelf. As the owner you can:
- **Mouse:** drag a book across the bookend.
- **Touch:** press and hold a book, then drag it.
- **Without dragging:** use "Mark finished" in the reader's top bar.

Drag a book back to the left to move it back to reading. Each move is one small commit. Guests see both sections but can't move books.

### What to know before adding books

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
- `npm run fonts` re-copies the WOFF2 files from Fontsource after a font upgrade. TeX Gyre Pagella is the exception: it is committed by hand, and `scripts/copy-fonts.mjs` says how it was built.
- `node scripts/make-fixtures.mjs` regenerates the test books.

### Project layout

| Path | What lives there |
|---|---|
| `src/shelf/` | Shelf view, wheel-to-horizontal scrolling |
| `src/spines/` | Spine art (one plain design), cover colors, palette, contrast, title and author fitting, spine fonts (`fonts.ts`) |
| `src/import/` | Drag overlay, file sniffing, DRM detection, metadata (title and author), add/edit book dialog, queue |
| `src/reader/` | Reader view, pdf.js renderer, foliate-js adapter, spread logic |
| `src/storage/` | Manifest model, IndexedDB cache, GitHub Git Data client, sync |
| `vendor/foliate-js/` | Vendored foliate-js at a pinned commit (MIT); see `VENDOR.md` |
| `library/` | The published library: `manifest.json` and `books/` |
| `src/leaderboard/` | Reading leaderboard check-in dialog, ranking and nudges, store client (loaded on acorn click) |
| `worker/leaderboard/` | The leaderboard's Cloudflare Worker, its validation, and `wrangler.toml` |

pdf.js and foliate-js load only when the reader or the import preview opens, so the shelf stays far under its JavaScript budget
