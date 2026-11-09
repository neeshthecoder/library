# Spec Delta

## Purpose

Lets the two readers of the shelf (A and M) log the last page they read in a book from the catalogue through a hidden check-in, and see a two-person leaderboard of their progress, without either needing a GitHub account.

## ADDED Requirements

### Requirement: Hidden acorn entry point
When a leaderboard service is configured, the first pair of acorns on top of the bookcase SHALL be a keyboard-operable button that opens the check-in dialog. It SHALL carry no visible label. When no service is configured, the acorns SHALL stay decorative.

#### Scenario: Opening the check-in
- **GIVEN** the site was built with a leaderboard service URL and the shelf shows the acorn pair
- **WHEN** the visitor clicks the acorns, or focuses them and presses Enter or Space
- **THEN** the check-in dialog opens asking for an initial

#### Scenario: No service configured
- **GIVEN** the site was built without a leaderboard service URL
- **WHEN** the visitor clicks the acorns
- **THEN** nothing happens and the acorns are not exposed as a button

#### Scenario: Only the first acorn pair
- **GIVEN** the shelf is long enough to show more than one acorn pair
- **WHEN** the visitor clicks a later acorn pair
- **THEN** nothing happens

### Requirement: Initial prompt
The dialog SHALL ask for a single-letter initial and accept `A` or `M` in either case. Any other single letter SHALL show "Feature Coming Soon!" with a control that closes the dialog. Escape SHALL close the dialog at any step without saving.

#### Scenario: Recognized initial
- **WHEN** the visitor enters `m` and continues
- **THEN** the dialog moves to book selection for reader M

#### Scenario: Unrecognized initial
- **WHEN** the visitor enters `Q` and continues
- **THEN** the dialog shows "Feature Coming Soon!" and a close control, and closing it returns focus to the acorns

#### Scenario: Escape
- **WHEN** the visitor presses Escape at any step
- **THEN** the dialog closes and nothing is saved

### Requirement: Book selection from the catalogue
After a recognized initial, the dialog SHALL let the reader pick a book from the shelf's catalogue, listing reading books before finished ones. It SHALL preselect the reader's last checked-in book when that book is still in the catalogue.

#### Scenario: Picking a book
- **GIVEN** the catalogue has books and reader A has no prior check-in
- **WHEN** the book step appears
- **THEN** every book in the catalogue is listed by title and none is preselected

#### Scenario: Returning reader
- **GIVEN** reader M last checked in on "The Pelican Brief"
- **WHEN** M reaches the book step
- **THEN** "The Pelican Brief" is preselected

### Requirement: Last page read
After a book is picked, the dialog SHALL ask for the last page read as a whole number and the book's total pages, prefilled from the catalogue's page count and editable. The page SHALL be between 0 and the total, and the total between 1 and 10000.

#### Scenario: Valid page
- **GIVEN** the chosen book's catalogue page count is 346
- **WHEN** the reader enters page 173 and saves
- **THEN** the check-in is saved as page 173 of 346, which is 50%

#### Scenario: Page past the end
- **WHEN** the reader enters page 400 of 346
- **THEN** the dialog refuses to save and says the page must be at most 346

#### Scenario: Different edition
- **WHEN** the reader changes the total to 420 and enters page 210
- **THEN** the check-in is saved as page 210 of 420, which is 50%

### Requirement: Two-reader leaderboard
After a successful save, or when a reader chooses to just view the board, the dialog SHALL show both readers with their book title, page, total, and percent complete, ordered by percent, highest first. A reader with no check-in SHALL be shown as not started.

#### Scenario: Board after saving
- **GIVEN** A is at 62% and M has just saved 41%
- **WHEN** the save succeeds
- **THEN** the board lists A (62%) above M (41%), each with book title and page

#### Scenario: Peeking without updating
- **WHEN** reader A, at the book step, chooses to just view the board
- **THEN** the board shows the current standings and nothing is saved

### Requirement: Nudge for the reader behind
The board SHALL show one playful motivational line, picked at random from a fixed list, next to the reader with the lower percent. When both readers are within one percentage point, it SHALL show a single shared "neck and neck" line instead.

#### Scenario: One reader behind
- **GIVEN** A is at 62% and M is at 41%
- **WHEN** the board is shown
- **THEN** a line such as "Keep up the pace, toots!" appears next to M only

#### Scenario: Tied
- **GIVEN** A is at 50% and M is at 50.4%
- **WHEN** the board is shown
- **THEN** a single shared tie line appears and neither reader gets a nudge

#### Scenario: One reader not started
- **GIVEN** only A has checked in
- **WHEN** the board is shown
- **THEN** M is shown as not started with a nudge

### Requirement: Constrained progress store
The progress store SHALL be the only write path the check-in uses. It SHALL accept only a reader (`A` or `M`), a book id present in the published catalogue, a page, and a total, and SHALL keep only each reader's latest check-in. It SHALL have no access to the site's repository.

#### Scenario: Valid check-in
- **WHEN** the store receives reader `M`, a catalogue book id, page 120, and total 300
- **THEN** it replaces M's record, taking the book title from the catalogue, and returns both readers' records

#### Scenario: Unknown reader or book
- **WHEN** the store receives reader `Z`, or a book id that isn't in the catalogue
- **THEN** it rejects the request and changes nothing

#### Scenario: Extra or malformed fields
- **WHEN** the store receives extra fields, a non-integer page, a page above the total, or a body over 1 KB
- **THEN** it rejects the request and changes nothing

#### Scenario: Reading the board
- **WHEN** anyone requests the current standings
- **THEN** the store returns the two readers' records and nothing else

### Requirement: Narrow network allowance
The production Content Security Policy SHALL allow connections to the progress store's origin in addition to the site and the GitHub API, and to no other new origin. Text from the store SHALL be inserted as text, never as markup.

#### Scenario: Store reachable
- **GIVEN** the site was built with a leaderboard service URL
- **WHEN** the check-in saves or loads the board
- **THEN** the request to that origin is allowed

#### Scenario: Hostile title text
- **WHEN** a stored record's book title contains markup
- **THEN** the board shows it as literal text

### Requirement: Save failure
If the store can't be reached or rejects a check-in, the dialog SHALL say the save failed, keep the reader's entries, and let them retry or close.

#### Scenario: Offline save
- **GIVEN** the device is offline
- **WHEN** the reader saves a page
- **THEN** the dialog says it couldn't save, the entered page stays filled in, and retrying after reconnecting saves it
