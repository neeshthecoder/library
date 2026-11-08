# Spec Delta

## Purpose

Provides the static application shell every view depends on: build and GitHub Pages deployment, routing, fonts and design tokens, security policy, and performance and accessibility baselines.

## ADDED Requirements

### Requirement: Static build deployable to GitHub Pages
The site SHALL build to purely static files and SHALL deploy to GitHub Pages through a GitHub Actions workflow that runs on every push to the default branch and on manual dispatch. The deployed site SHALL include the library manifest and book files committed in the repository.

#### Scenario: Push triggers deploy
- **WHEN** a commit is pushed to the default branch
- **THEN** the workflow builds the site and publishes it, including the library directory, to GitHub Pages

#### Scenario: Rapid successive commits
- **WHEN** a second commit lands while a deploy for an earlier commit is still running
- **THEN** the site ends up serving the content of the latest commit

#### Scenario: Project-site base path
- **WHEN** the site is served from `https://<owner>.github.io/<repo>/`
- **THEN** every asset, font, and library URL resolves under that base path

### Requirement: Hash-based routing
The site SHALL expose the shelf at `#/` and a book's reader at `#/read/<book-id>`, so that deep links, reloads, and the browser back button work without server-side rewrites.

#### Scenario: Reload in the reader
- **WHEN** the user reloads the page while on `#/read/<book-id>`
- **THEN** the same book reopens in the reader at the saved position

#### Scenario: Unknown book id
- **WHEN** the user opens `#/read/<id>` for an id not in the library
- **THEN** the shelf is shown with a plain message that the book is no longer in the library

#### Scenario: Back button
- **WHEN** the user opens a book from the shelf and presses the browser back button
- **THEN** the shelf is shown

### Requirement: Styleguide-conformant chrome
All interface chrome SHALL use the styleguide's color tokens, Instrument Serif (display only, at `display-md` or larger, weight 400) and Inter (all UI and body text), the spacing scale, pill buttons, linen inputs, and the single permitted shadow. Each view SHALL contain at most one primary (navy) action.

#### Scenario: Serif usage on the shelf
- **WHEN** the shelf view is rendered
- **THEN** the headline "The bookshelf." is the only text set in the serif

#### Scenario: Token colors only
- **WHEN** any interface chrome (not spine or shelf illustration) is inspected
- **THEN** every color comes from a styleguide token

### Requirement: Documented styleguide exemptions
Book spines, bookmark ribbons, and the shelf bar SHALL be treated as illustration and MAY use colors outside the token palette, ornament, and star motifs. The drag overlay SHALL be the only chrome element using a visible outline. These exemptions SHALL be recorded in the project's documentation.

#### Scenario: Exemptions are documented
- **WHEN** a contributor reads the project README or styleguide notes
- **THEN** the spine, shelf, and drag-overlay deviations and their reasons are listed

### Requirement: Self-hosted fonts without layout shift
Fonts SHALL be self-hosted as Latin-subset WOFF2 files, the serif SHALL be preloaded, and each family SHALL use `font-display: swap` with a metric-matched fallback so that font swapping causes no measurable layout shift.

#### Scenario: Font swap
- **WHEN** the shelf loads on a slow connection and the web fonts arrive after first paint
- **THEN** cumulative layout shift stays below 0.05

#### Scenario: No third-party font requests
- **WHEN** the site loads
- **THEN** no request is made to a third-party font host

### Requirement: Performance budgets
The shelf route SHALL ship less than 150 KB of gzipped JavaScript. PDF and ebook rendering code SHALL load only when the reader or the import preview needs it. On a mobile 4G profile the shelf SHALL achieve LCP under 2.0 s, CLS under 0.05, and INP under 200 ms.

#### Scenario: Shelf bundle size
- **WHEN** the production build completes
- **THEN** the JavaScript required to render the shelf totals less than 150 KB gzipped, and the build fails if it does not

#### Scenario: Renderer loaded lazily
- **WHEN** the user opens the shelf without opening a book or the import preview
- **THEN** no PDF or ebook rendering code is downloaded

### Requirement: Content Security Policy
The site SHALL enforce a Content Security Policy that allows scripts only from its own origin, allows network connections only to its own origin and the GitHub API, and prevents scripts embedded in book content from executing.

#### Scenario: Script inside an EPUB
- **WHEN** the user opens an EPUB whose content contains an inline or external script
- **THEN** the script does not execute and the book still renders

#### Scenario: Disallowed connection
- **WHEN** any code attempts a network request to a host other than the site origin or `api.github.com`
- **THEN** the browser blocks the request

### Requirement: Accessibility baseline
The site SHALL meet WCAG 2.2 AA. Every interactive element SHALL have a visible 2px navy focus ring with 2px offset and a touch target of at least 44×44 px, layouts SHALL hold at 320 px width and 200% zoom, and non-essential animation SHALL be removed when the user prefers reduced motion.

#### Scenario: Keyboard focus
- **WHEN** a keyboard user tabs through any view
- **THEN** each focused control shows the focus ring and is reachable in a logical order

#### Scenario: Reduced motion
- **WHEN** the user's system requests reduced motion
- **THEN** hover lifts, crossfades, and the headline entrance happen without transition

### Requirement: Browser support
The site SHALL work in current versions of Chrome, Safari, and Firefox on desktop and mobile.

#### Scenario: Mobile Safari
- **WHEN** the user opens the site in current iOS Safari
- **THEN** the shelf scrolls, books open in the reader, and books can be added through the file picker
