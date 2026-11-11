# Spec Delta

## Purpose

Lets the owner change a book's title, author, spine font and spine colors after it's on the shelf, without deleting and re-uploading the file.

## ADDED Requirements

### Requirement: Spine context menu
On an owner's device, a secondary click on a spine SHALL open a small menu next to it with one item, "Edit". The menu SHALL also open from the keyboard's context-menu key or Shift+F10 on a focused spine, and from a touch press-and-hold released without moving. Guests SHALL get no menu.

#### Scenario: Right-click as owner
- **GIVEN** the device is signed in as owner
- **WHEN** the owner right-clicks the spine of "Middlemarch"
- **THEN** a menu with a single "Edit" item appears next to that spine, and the browser's own context menu does not

#### Scenario: Keyboard
- **GIVEN** the owner has focused a spine with Tab
- **WHEN** they press Shift+F10
- **THEN** the menu opens with "Edit" focused

#### Scenario: Touch press-and-hold
- **GIVEN** the owner is on a touch device
- **WHEN** they press and hold a spine and lift their finger without moving it
- **THEN** the menu opens; pressing, holding and dragging still moves the book between sections as before

#### Scenario: Guest
- **GIVEN** the device is not signed in
- **WHEN** the visitor right-clicks a spine
- **THEN** no "Edit" menu appears

#### Scenario: Dismissing the menu
- **WHEN** the menu is open and the owner presses Escape or clicks elsewhere
- **THEN** the menu closes and focus returns to the spine

### Requirement: Edit dialog
Choosing "Edit" SHALL open the book's details dialog prefilled with its current title, author, font and colors, with a live spine preview, a primary "Save" button and a secondary "Cancel" button. Title SHALL be required; author SHALL be optional.

#### Scenario: Prefilled
- **GIVEN** a book titled "Midlemarch" by "George Eliot" in EB Garamond
- **WHEN** the owner chooses "Edit"
- **THEN** the dialog shows those values and the spine preview matches the shelf

#### Scenario: Empty title
- **WHEN** the owner clears the title and presses "Save"
- **THEN** the dialog shows "Add a title." and saves nothing

#### Scenario: Cancel
- **WHEN** the owner changes fields and then presses "Cancel" or Escape
- **THEN** the dialog closes and the book is unchanged

### Requirement: Saving an edit
Saving SHALL update the spine on the shelf immediately and record the change in the library as one commit, so other devices see it after the site redeploys. The book's file, position, finished state and dimensions SHALL stay unchanged.

#### Scenario: Fixing a typo
- **WHEN** the owner changes "Midlemarch" to "Middlemarch" and saves
- **THEN** the spine shows "Middlemarch" right away, the spine's accessible name and tooltip use the new title, and the library manifest records the new title

#### Scenario: Adding an author to an older book
- **GIVEN** a book added before authors existed
- **WHEN** the owner enters "Ursula K. Le Guin" and saves
- **THEN** the author appears under the title on the spine

#### Scenario: Clearing the author
- **WHEN** the owner empties the author field and saves
- **THEN** the spine shows only the title

#### Scenario: Save fails
- **GIVEN** the device is offline
- **WHEN** the owner saves an edit
- **THEN** the spine goes back to how it was and a message says the changes to that book couldn't be saved, the same way a failed "Mark finished" is reported

#### Scenario: Nothing changed
- **WHEN** the owner opens Edit and presses "Save" without changing anything
- **THEN** the dialog closes and no commit is made

### Requirement: Edits and other changes don't clobber each other
An edit SHALL change only the edited fields. It SHALL apply on top of the latest library, so a position sync, a finish move or an edit from another device made in the meantime is kept. When two devices edit the same book, the later save SHALL win.

#### Scenario: Edit while reading position syncs
- **GIVEN** another device synced a new reading position for the book
- **WHEN** this device saves a new title for it
- **THEN** the library has both the new title and the new position
