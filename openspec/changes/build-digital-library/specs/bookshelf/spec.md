# Spec Delta

## Purpose

The main view of the library: every book shown as an upright spine on one continuous horizontal shelf that the user scrolls, browses, and opens books from.

## ADDED Requirements

### Requirement: Shelf headline
The shelf view SHALL show the headline "The bookshelf." centered at the top as a level-one heading in the display serif.

#### Scenario: Headline rendered
- **WHEN** the shelf view loads
- **THEN** an `h1` reading "The bookshelf." is centered above the shelf

### Requirement: Single continuous shelf
All books SHALL be shown as spines standing upright on one horizontal shelf, flush left, ordered oldest on the left to most recently added on the right. The shelf bar SHALL extend just past the last spine.

#### Scenario: Ordering
- **WHEN** the library holds books added on three different dates
- **THEN** the spines appear left to right from the earliest added to the most recently added

#### Scenario: Shelf length
- **WHEN** the shelf renders with any number of books
- **THEN** the shelf bar starts at the first spine and ends a small fixed distance past the last spine

#### Scenario: Newly added book is revealed
- **WHEN** a book is added to the shelf
- **THEN** the shelf scrolls so the new spine is visible

### Requirement: Hand-placed spine variation
Spines SHALL vary slightly in height and width so the shelf looks hand-placed, and each book's dimensions SHALL be stable across reloads and devices.

#### Scenario: Stable dimensions
- **WHEN** the same library is opened on two different devices
- **THEN** each book's spine has the same relative height and width on both

### Requirement: Horizontal scrolling from any input
The shelf SHALL scroll horizontally in response to vertical mouse-wheel and trackpad scrolling, native horizontal swipes, and the Left/Right arrow keys when focus is on the shelf. It SHALL show no scrollbar chrome beyond what the platform needs.

#### Scenario: Vertical wheel
- **WHEN** the pointer is over the shelf and the user scrolls the mouse wheel down
- **THEN** the shelf moves to reveal books further to the right

#### Scenario: Wheel at the end of the shelf
- **WHEN** the shelf is already scrolled fully to one end and the user keeps wheeling in that direction
- **THEN** the page is not blocked from its normal vertical scrolling

#### Scenario: Arrow keys move between spines
- **WHEN** a spine has focus and the user presses the Right arrow
- **THEN** focus moves to the next spine and the shelf scrolls to keep it visible

#### Scenario: Touch swipe
- **WHEN** the user swipes horizontally on the shelf on a touch device
- **THEN** the shelf scrolls with native momentum

### Requirement: Spines are accessible buttons
Each spine SHALL be a focusable button whose accessible name is the book's title. Activating it SHALL open the book in the reader.

#### Scenario: Screen reader name
- **WHEN** a screen reader focuses a spine
- **THEN** it announces the book's full title as a button, even if the visible title is truncated

#### Scenario: Open a book
- **WHEN** the user clicks a spine or presses Enter or Space on a focused spine
- **THEN** the reader opens for that book

### Requirement: Hover and focus lift
A spine SHALL lift slightly when hovered or focused, using a transform-only transition of 150 ms, and SHALL lift without transition when reduced motion is preferred.

#### Scenario: Hover
- **WHEN** the pointer moves over a spine
- **THEN** the spine rises a short distance over 150 ms without changing the layout of neighboring spines

### Requirement: Bookmark ribbon on started books
A book the user has started reading SHALL show a small ribbon bookmark peeking above the top of its spine, colored with the spine's trim (or accent) color. Books never opened SHALL show no ribbon.

#### Scenario: Started book
- **WHEN** the user has turned at least one page in a book and returns to the shelf
- **THEN** that book's spine shows the ribbon in its trim color

#### Scenario: Progress announced
- **WHEN** a screen reader focuses a started book's spine
- **THEN** it also announces the reading progress as a description

### Requirement: Empty state
When the library has no books, the shelf view SHALL show a short line of sans text inviting the user to drop a book anywhere, along with the "Add book" button.

#### Scenario: Empty library
- **WHEN** the manifest contains no books
- **THEN** the view shows the headline, the line "Drop a book anywhere to add it.", and the "Add book" button

### Requirement: Add book control
The shelf view SHALL show a minimal secondary "Add book" button that opens the system file picker for supported book files.

#### Scenario: Keyboard upload
- **WHEN** a keyboard user activates "Add book"
- **THEN** a file picker opens filtered to PDF, EPUB, MOBI, and AZW3 files

### Requirement: Library size readout
The shelf view SHALL show, in unobtrusive fine text, the number of books and the total size of the library against the approximate 1 GB limit.

#### Scenario: Size shown
- **WHEN** the library holds 12 books totalling 184 MB
- **THEN** the shelf shows text equivalent to "12 books · 184 MB of about 1 GB"

#### Scenario: Approaching the limit
- **WHEN** the library total exceeds 800 MB
- **THEN** the readout states that the library is close to its storage limit
