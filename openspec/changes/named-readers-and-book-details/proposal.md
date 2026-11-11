# Proposal

## Why

Every spine uses one typeface and shows only a title, and a book's title can't be fixed once it's on the shelf, so a typo or a missing author means deleting and re-uploading the book.

## What Changes

- The add-book preview gets a **Font** choice for the spine title. Options: Instrument Serif (the current look and the default), plus free equivalents of the fonts the owner asked for: EB Garamond (Garamond), Cardo (Bembo), TeX Gyre Pagella (Palatino), Cormorant Garamond (Sabon) and Crimson Pro (Minion).
- The add-book preview gets an optional **Author** field, prefilled from the file's metadata when present. The author is shown on the spine in smaller text under the title.
- Owners can right-click a spine (or long-press it on touch, or use the keyboard's context-menu key) to open a small menu with **Edit**. Edit opens the same dialog as adding a book, prefilled, and saves changes to title, author, font and colors as one commit to the library.
- Books added before this change keep rendering exactly as today: no author, Instrument Serif.
- The reading leaderboard is not changed.

## Capabilities

### New Capabilities
- `book-editing`: Changing a shelved book's title, author, font and colors after it's been added, through the spine's context menu, and syncing that change to the library.

### Modified Capabilities
- `book-spines`: The title can be set in one of six fonts; an optional author line sits under the title.
- `book-import`: The preview dialog adds Font and Author fields, and the author is prefilled from file metadata.

## Impact

- **Manifest** (`src/storage/manifest.ts`): optional `author` on a book and optional `font` in its spine settings, plus a new `edit` operation. The version stays 1; older manifests stay valid.
- **Spines** (`src/spines/spine.ts`, `title-fit.ts`, `spine.css`): fit the title and author in the panel using the chosen font.
- **Import** (`src/import/preview-dialog.ts`, `metadata.ts`, `queue.ts`): new fields, author extraction.
- **Shelf** (`src/shelf/shelf-view.ts`): context menu and long-press handling next to the existing drag-to-finish gesture.
- **Fonts**: five new self-hosted WOFF2 font files (Latin subset), loaded only when a spine uses them. Four come from Fontsource packages; TeX Gyre Pagella is vendored under its GUST Font License.
- **README**: adding-books and editing instructions.
- **Leaderboard**: no code changes. It keeps the title saved at each check-in, so a renamed book shows its old title there until the next check-in on it.
- **Ordering**: this change modifies requirements introduced by `build-digital-library`, which hasn't been archived yet. Archive it first.
