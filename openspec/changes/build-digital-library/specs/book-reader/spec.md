# Spec Delta

## Purpose

Lets the user read a book as a two-page spread (or one page on narrow screens), turn pages by keyboard, pointer, or touch, see progress, return to the shelf, and delete the book.

## ADDED Requirements

### Requirement: Native format rendering
The reader SHALL render PDF, EPUB, MOBI, and AZW3 files in the browser in their own format, without converting reflowable books to PDF.

#### Scenario: EPUB reflows
- **WHEN** the user opens an EPUB and resizes the window
- **THEN** the text reflows to the new page size

#### Scenario: PDF fidelity
- **WHEN** the user opens a PDF
- **THEN** its pages render with their original layout, sharp at the device's pixel density

### Requirement: Two-page spread
On wide viewports the reader SHALL show two facing pages centered on a calm paper background, like an open book. For PDFs the first page SHALL appear alone on the right, followed by facing pairs.

#### Scenario: Wide screen
- **WHEN** the user opens a book on a viewport at least 48rem wide in landscape orientation
- **THEN** two facing pages are shown side by side

#### Scenario: PDF opening spread
- **WHEN** a PDF opens at its first page on a wide screen
- **THEN** page 1 is shown alone on the right and the next spread shows pages 2 and 3

### Requirement: Single-page fallback
On narrow or portrait viewports the reader SHALL show one page at a time.

#### Scenario: Phone
- **WHEN** the user opens a book on a 390 px wide phone
- **THEN** one page fills the reading area

#### Scenario: Rotation keeps place
- **WHEN** the user rotates a tablet from portrait to landscape
- **THEN** the reader switches to a spread that includes the page being read

### Requirement: Page navigation
The user SHALL be able to turn forward and back with the Right and Left arrow keys, by clicking or tapping the right or left page edge, and by swiping on touch devices. Page changes SHALL be instant or use at most a 150 ms crossfade, with no page-flip animation.

#### Scenario: Arrow keys
- **WHEN** the user presses the Right arrow
- **THEN** the next spread (or page) is shown

#### Scenario: Edge tap
- **WHEN** the user taps the left edge of the reading area
- **THEN** the previous spread (or page) is shown

#### Scenario: Swipe
- **WHEN** the user swipes left on a touch device
- **THEN** the next spread (or page) is shown

#### Scenario: Boundaries
- **WHEN** the user is on the last spread and presses the Right arrow
- **THEN** nothing changes and no error is shown

#### Scenario: Accessible edge controls
- **WHEN** a screen reader user explores the reader
- **THEN** the edges are exposed as "Previous page" and "Next page" buttons

### Requirement: Resume at last position
The reader SHALL open each book at the position where the user last left it: the page for PDFs and the reading location for EPUB, MOBI, and AZW3.

#### Scenario: Reopen
- **WHEN** the user leaves an EPUB at chapter 7 and later opens it again on the same device
- **THEN** it opens at the same location in chapter 7

#### Scenario: First open
- **WHEN** the user opens a book for the first time
- **THEN** it opens at the beginning

### Requirement: Reader top bar
The reader SHALL show a minimal top bar with a back-to-shelf control on the left, a small progress indicator, and a small delete control on the right.

#### Scenario: Progress for a PDF
- **WHEN** the user is on pages 12–13 of a 240-page PDF
- **THEN** the progress indicator reads "12–13 of 240"

#### Scenario: Progress for an EPUB
- **WHEN** the user is 34% through an EPUB
- **THEN** the progress indicator reads "34%"

### Requirement: Return to the shelf
Pressing Escape or the back control SHALL return the user to the shelf, with focus on the spine of the book just read.

#### Scenario: Escape
- **WHEN** the user presses Escape in the reader with no dialog open
- **THEN** the shelf is shown and that book's spine has focus

### Requirement: Delete with confirmation
The delete control SHALL open a confirmation dialog reading "Delete [title]? This removes the file from your library." with "Delete" and "Cancel" actions. Confirming SHALL remove the book from the library and return to the shelf.

#### Scenario: Confirm delete
- **WHEN** the user confirms deletion of "Middlemarch"
- **THEN** the book's file and manifest entry are removed, its local cache is cleared, and the shelf no longer shows it

#### Scenario: Cancel delete
- **WHEN** the user presses "Cancel" or Escape in the confirmation dialog
- **THEN** the dialog closes and the reader stays open

#### Scenario: Delete without a connection
- **WHEN** the user tries to delete on a device not connected to GitHub
- **THEN** the user is asked to connect the library before deleting

### Requirement: Loading and failure states
While a book loads, the reader SHALL show a quiet loading state. If the file cannot be fetched or parsed, it SHALL show a plain error with a way back to the shelf.

#### Scenario: File missing
- **WHEN** a book's file cannot be fetched from the site or the local cache
- **THEN** the reader says the file couldn't be loaded and offers "Back to shelf"
