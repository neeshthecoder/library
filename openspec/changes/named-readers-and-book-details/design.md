# Design

## Context

See proposal.md for motivation, and the specs in this change for the required behavior.

How the code works today, where it matters for this change:

- **Spine typography.** One typeface, Instrument Serif. It's self-hosted from `public/fonts/` via `src/styles/fonts.css`, and `scripts/copy-fonts.mjs` copies it out of a Fontsource package. `canvasMeasure()` in `src/spines/title-fit.ts` hard-codes that font string, and `fitTitle` fits the title into the whole middle panel.
- **Manifest edits.** Changes go through `Op`s in `src/storage/manifest.ts`. "Mark finished" (`Library.setFinished`) is the model for a small metadata change: it shows the change right away as a pending op, makes one `commit()` that reapplies the change to the latest remote manifest, and if the commit fails it reverts and `main.ts` shows a message.
- **Shelf gestures.** On an owner's device, `ShelfView.#bindDrag` handles pointer drags. A touch press-and-hold of 350 ms starts a drag. The `contextmenu` event is only suppressed while a drag is in progress.
- **Spec drift (not fixed here).** The existing `book-spines` requirement "Vertical title in the middle panel" says the title is set in the sans and rotated. The code sets it horizontally in the serif. This change leaves that requirement alone and adds font and author requirements next to it. Correct the old text in a separate change.

## Goals / Non-Goals

**Goals:**
- Older manifests and books keep working and look the same.
- New fonts cost nothing for visitors whose shelf doesn't use them.

**Non-Goals:**
- Any change to the reading leaderboard, its Worker or its stored data.
- Editing the book file, page count or spine dimensions. A book can't be re-uploaded in place.
- Font weights other than one regular weight per family, italic, or per-book font size.
- Showing the author in the reader view or anywhere other than the spine and its accessible name.

## Decisions

### 1. Font registry
A new `src/spines/fonts.ts` exports `SPINE_FONTS`, a fixed ordered list of `{ id, label, family, stack, weight }`:

| id | label | stands in for | source | weight |
|---|---|---|---|---|
| `instrument-serif` (default) | Instrument Serif | the current look | `@fontsource/instrument-serif` (already used) | 400 |
| `eb-garamond` | EB Garamond | Adobe Garamond Pro | `@fontsource/eb-garamond` | 400 |
| `cardo` | Cardo | Bembo MT Pro | `@fontsource/cardo` | 400 |
| `pagella` | TeX Gyre Pagella | Palatino Linotype | vendored from CTAN (GUST Font License) | 400 |
| `cormorant-garamond` | Cormorant Garamond | Sabon LT Pro | `@fontsource/cormorant-garamond` | 500 |
| `crimson-pro` | Crimson Pro | Minion Pro | `@fontsource/crimson-pro` | 400 |

`fontFor(id?)` returns the entry, or the default when the id is missing or unknown.

- **Pagella** isn't on Fontsource. Convert `texgyrepagella-regular.otf` once to a Latin-subset WOFF2 (fontTools `pyftsubset --flavor=woff2` with the same unicode range as the other fonts). Commit it to `public/fonts/` with its license text, and record the source URL and command in `scripts/copy-fonts.mjs` as a comment. Relying on the operating system's own Palatino was rejected: Android and Linux don't have it, and canvas metrics would differ by device.
- **Cormorant Garamond** is used at weight 500 because 400 is too thin for small spine text.
- **Cost.** One `@font-face` per family in `fonts.css`, with `font-display: swap` and the same Latin `unicode-range`. Browsers only download a face that's actually used, so a shelf in Instrument Serif fetches nothing new. The fonts are CSS and static files, not JavaScript, so `check:size` is unaffected.

### 2. Measuring with the right font
`canvasMeasure(font)` takes a registry entry and sets `ctx.font` from its weight and stack, with one cache per font. `renderSpine` picks the measurer for `spine.font`. If `document.fonts.check()` says the face isn't loaded, the spine renders with fallback metrics right away, then calls `document.fonts.load()` and re-renders once the font arrives. The shelf view keys this on font id, so each family triggers one re-fit of its spines. The preview dialog does the same for its single spine.

*Alternative:* hold the shelf until every font loads. That delays first paint on a slow network for a purely cosmetic gain.

### 3. Author line layout
`fitTitle` stays as it is. When there's an author, `renderSpine`:
1. Wraps the author with the title's `wrap()` at 11 px (smaller than the title's 12 px minimum, so it reads as secondary), onto as many lines as it needs. It never truncates the author.
2. Reserves `lines × size × LINE_HEIGHT + 4 px` at the bottom of the panel and fits the title into the rest.
3. If that would truncate a title that fits on its own, it retries at 10 px, then 9 px, and otherwise drops the author and fits the title into the full panel. The owner asked for no ellipsis on authors, so an author is left off rather than cut.

The title and author are positioned as one block, centered vertically in the panel. The author is a sibling `span.spine-author` styled like `.spine-title` (same ink, same font, `aria-hidden`). When there's an author, the spine button's `aria-label` becomes `"<title>, <author>"` and its `title` tooltip `"<title> by <author>"`. The accessible name can't use "by": axe's label-in-name rule (WCAG 2.5.3) needs the name to contain the visible text, which reads "<title> <author>".

### 4. Data model and the `edit` op
- `Book.author?: string | null`. Absent or null means no author. It's trimmed and whitespace-collapsed, at most 120 characters.
- `SpineSettings.font?: string`. Absent means Instrument Serif. Unknown ids are kept in the manifest as-is (a newer client may know them) but render with the default.
- New op: `{ type: 'edit', id, changes: { title?, author?, spine?: Partial<Pick<SpineSettings, 'source' | 'design' | 'bg' | 'trim' | 'ink' | 'font'>> } }`. `editBook(m, id, changes)` merges only the given fields into that one book and leaves its `h`, `w`, position, `finishedAt`, file and length alone. It returns `m` unchanged if nothing differs, so a no-op Save makes no commit. `isReflected` for `edit` is true when the book is gone or every given field already matches.
- `manifest.version` stays 1. Every new field is optional, and older clients copy book objects with `{...b}`, which keeps fields they don't know about.

*Alternative:* a whole-book replace op. Rejected because it would overwrite a position or finish state committed by another device in the meantime.

### 5. `Library.editBook`
This mirrors `setFinished`. Pending key `edit:<id>`, optimistic `store.set`, then one `commit((m) => editBook(m, id, changes), [], 'Edit "<new title>"')`. On failure it reverts to the previous pending entry and rethrows, and `main.ts` shows "<title>: changes couldn't be saved. …" through `showMessages`. A second edit to the same book before the first commits replaces the pending entry and merges its changes on top. The commit reapplies the change to the latest remote manifest, so the last save wins for the fields it touches.

### 6. One dialog for add and edit
`openPreviewDialog` becomes `openBookDialog(input)` with `mode: 'add' | 'edit'`. In edit mode the heading is "Edit book", the primary button is "Save", the fields are prefilled from the book, and "Use cover colors" uses `book.cover`. New controls in both modes:
- **Author:** a text input, `maxlength=120`, prefilled from metadata on add.
- **Font:** a radio group of six options (`role="radiogroup"`, arrow keys move between them). Each label is the font's name set in that font. Radio buttons were chosen over `<select>` because Safari and Firefox ignore `font-family` on `<option>`. Rendering the labels loads all six faces, which is acceptable because only the owner sees this dialog.

`PreviewResult` gains `author` and `spine.font`. The import queue passes them into the new `Book`.

### 7. Author metadata
`BookInfo` gains `author: string | null`.
- **PDF:** XMP `dc:creator` (a list) first, then `info.Author`.
- **EPUB/MOBI/AZW3:** foliate's `book.metadata.author`, which can be a string, a localized-string object, a contributor object `{ name }`, or an array of any of these.

`normalizeAuthor` flattens all of these, removes empty and duplicate names, joins them with ", ", collapses whitespace, and truncates to 120 characters. Junk values such as "Unknown" or "Administrator" are treated as missing, using a small deny-list.

### 8. Context menu on the shelf
`ShelfView` gets an `onEdit(id)` hook, wired up the same way as the existing finish hook.
- **Mouse and keyboard:** a `contextmenu` listener on the spine list. When the device is the owner's, no drag is active, and the target is a spine, it calls `preventDefault()` and opens the menu. Shift+F10 and the context-menu key fire the same event on the focused spine. When the event has no pointer coordinates, the menu anchors to the spine's rectangle.
- **Touch:** the existing long-press already arms a drag at 350 ms. `#endDrag` now tracks the farthest the pointer moved. If a touch drag ends having moved less than 8 px since it was armed, the drag is cancelled, the click is suppressed, and the menu opens. Android's native long-press `contextmenu` is already blocked while a drag is armed, so it can't open twice.
- **The menu:** an absolutely positioned `div role="menu"` with one `button role="menuitem"` labelled "Edit". It's appended to the bookcase and kept inside the viewport. Escape, a click outside, scrolling the shelf, or the shelf re-rendering closes it and returns focus to the spine. When the device isn't the owner's, nothing is intercepted and the browser's native menu shows.

## Risks / Trade-offs

- [Long-press now does two things: hold-and-drag moves the book, hold-and-release opens the menu.] → The two are told apart by movement after the hold, which is what users expect. E2E tests cover both on a touch device profile.
- [Six fonts have different metrics, so a spine re-fits when its font arrives, which shows as a brief jump on a cold load.] → `font-display: swap` plus re-fitting once per family. It only happens on a first visit before the fonts are cached.
- [The Pagella WOFF2 is vendored by hand, so it won't update with `npm run fonts`.] → The source and the conversion command are recorded next to the copy script. The font hasn't changed upstream in years.
- [The leaderboard stores the book title at check-in time, so after a rename, existing leaderboard entries show the old title.] → Accepted, since the leaderboard is out of scope. The next check-in on that book stores the new title, and the leaderboard's book picker already lists current titles because it reads the shelf.
- [An edit that is committed while an older device has a pending `positions` op] → Both ops reapply to the latest remote manifest and touch different fields, so neither is lost.

## Migration Plan

1. Merge the code. The unit and E2E tests cover old manifests without `author` or `font`.
2. Push to `main` so Pages redeploys the site. Nothing else needs deploying.
3. **Rollback:** revert the commit and redeploy. Books edited in the meantime keep their `author`/`font` fields. The old site ignores them and still shows the edited title.
