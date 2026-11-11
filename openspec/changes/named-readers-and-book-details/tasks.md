# Tasks

## 1. Manifest: author, font and the edit op

- [x] 1.1 Add optional `Book.author` and `SpineSettings.font` to `src/storage/manifest.ts`, the `edit` op, `editBook()` (merges only given fields, keeps `h`/`w`/position/`finishedAt`/file, and returns the same manifest when nothing changes), and `edit` handling in `applyOp` and `isReflected`; verify in `tests/unit/manifest.test.ts` that an old manifest without these fields still parses, that an edit applied over a newer position keeps both, and that a no-op edit returns `m` unchanged
- [x] 1.2 Add `Library.editBook(id, changes)` in `src/storage/library.ts`, modelled on `setFinished` (pending key `edit:<id>`, optimistic update, one commit `Edit "<title>"`, revert and rethrow on failure, merge a second pending edit of the same book); verify in `tests/unit/library.test.ts` with `fake-github.ts` for success, failure revert, and the edit-then-position-sync case

## 2. Spine fonts

- [x] 2.1 Add the `@fontsource/eb-garamond`, `cardo`, `cormorant-garamond` (500) and `crimson-pro` devDependencies and extend `scripts/copy-fonts.mjs`; vendor a Latin-subset `tex-gyre-pagella-latin-400.woff2` built from CTAN's `texgyrepagella-regular.otf` with `pyftsubset --flavor=woff2`, with its GUST license file next to it in `public/fonts/` and the source URL and command in a comment in the script; verify `npm run fonts` writes all files and `ls public/fonts` shows six WOFF2 files
- [x] 2.2 Add one `@font-face` per new family to `src/styles/fonts.css` (`font-display: swap`, same `unicode-range`), and create `src/spines/fonts.ts` with `SPINE_FONTS` and `fontFor()` (unknown or missing id → Instrument Serif); verify with a unit test for `fontFor`, and with a Playwright network assertion in `tests/e2e/style.spec.ts` that a shelf where every book uses the default font requests no new font files
- [x] 2.3 Make `canvasMeasure(font)` take a registry entry, cache per font, and have `renderSpine` set the title's `font-family`/`font-weight` and measure with the book's font; re-fit spines once per family after `document.fonts.load()` resolves, in both `shelf-view.ts` and the preview; verify with `tests/unit/title-fit.test.ts`/`spine.test.ts` (the measurer is chosen by font, and an unknown font renders exactly like today) and run `npm run check:size`

## 3. Author line on spines

- [x] 3.1 In `src/spines/spine.ts` and `spine.css`, render an `aria-hidden` `.spine-author` line at 11 px under the title (same font and ink), reserve its height before fitting the title, truncate it with an ellipsis when it's too wide, drop it when the panel can't fit one title line at `MIN_SIZE` plus the author, and center title and author together; verify in `tests/unit/spine.test.ts` that a book with no author renders identically to before (snapshot), plus the long-author ellipsis and short-panel drop cases
- [x] 3.2 Set each spine button's `aria-label` to `"<title>, <author>"` and `title` to `"<title> by <author>"` when there's an author in `src/shelf/shelf-view.ts`; verify in `tests/e2e/a11y.spec.ts` (axe passes, and the accessible name includes the author)

## 4. Author metadata and the add dialog

- [x] 4.1 Add `author` to `BookInfo` in `src/import/metadata.ts` with `normalizeAuthor` (strings, localized objects, `{name}` contributors and arrays; dedupe, join with ", ", collapse whitespace, 120-character cap, deny-list "Unknown"/"Administrator"), reading PDF XMP `dc:creator` then `info.Author`, and foliate's `metadata.author`; verify with a new `tests/unit/metadata-author.test.ts` and the EPUB/PDF fixtures (add creators to fixtures in `scripts/make-fixtures.mjs` if needed)
- [x] 4.2 Turn `openPreviewDialog` into `openBookDialog({ mode: 'add' | 'edit', … })` in `src/import/preview-dialog.ts`, adding the Author input (`maxlength=120`) and a Font radio group whose labels are set in their own fonts with Instrument Serif preselected on add; return `author` and `spine.font`, and pass them into the new `Book` in `src/import/queue.ts`; verify in `tests/e2e/import.spec.ts` that the author is prefilled, picking EB Garamond updates the preview, and the added book's manifest entry has `author` and `spine.font`
- [x] 4.3 Update the README's adding-books text to mention author and font; verify it reads correctly next to the dialog

## 5. Editing from the shelf

- [x] 5.1 Add the owner-only spine context menu to `src/shelf/shelf-view.ts`: `contextmenu` (mouse, Shift+F10, menu key) opens a `role="menu"` with one "Edit" `menuitem`, positioned at the pointer or the spine and kept on screen; Escape, outside click, scroll or re-render closes it and returns focus; guests get the native menu; verify in a new `tests/e2e/edit.spec.ts` for owner right-click, Shift+F10 with "Edit" focused, guest right-click (no menu), and Escape
- [x] 5.2 Make a touch press-and-hold released after moving less than 8 px cancel the armed drag, suppress the click, and open the menu, while hold-and-drag still moves the book; verify in `tests/e2e/edit.spec.ts` and `tests/e2e/finished.spec.ts` under a touch device profile
- [x] 5.3 Add an `onEdit` hook wired in `src/main.ts`: open `openBookDialog` in edit mode prefilled from the book (cover colors from `book.cover`), call `library.editBook` on Save, close without a commit when nothing changed, and on failure show "<title>: changes couldn't be saved." via `showMessages`; verify in `tests/e2e/edit.spec.ts` that a rename updates the spine and the manifest commit, clearing the author removes the line, Cancel changes nothing, and an offline save reverts with the message
- [x] 5.4 Add an "Editing a book" note to the README (right-click, Shift+F10 or press-and-hold → Edit; owner only; one commit per save; leaderboard entries keep the old title until the next check-in); verify it matches the behavior in 5.1–5.3

## 6. Integration

- [x] 6.1 Run `npm test`, `npm run build`, `npm run check:size` and `npm run test:e2e`, and confirm all pass, including the unchanged `tests/e2e/leaderboard.spec.ts`
- [x] 6.2 With `npm run dev`, add a book in each of the six fonts with and without an author, then rename one and edit its font, and confirm the spines look right in both light and dark themes

## Workflow follow-up

- Archive `build-digital-library` before archiving this change. This change modifies requirements it introduces, and `openspec/specs/` is still empty.
