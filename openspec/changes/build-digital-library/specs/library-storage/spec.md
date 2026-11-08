# Spec Delta

## Purpose

Keeps the library permanent and visible from any device on a static host: book files and a manifest stored in the site's GitHub repository, written with a device-local token, cached locally, with reading positions saved locally and synced.

## ADDED Requirements

### Requirement: Repository-backed library
Book files and a JSON library manifest SHALL be stored in the site's GitHub repository and published with the site. Each manifest entry SHALL record the book's id, title, file path, format, size, date added, spine settings, cover-derived colors, length estimate, and last reading position.

#### Scenario: Visible from another device
- **WHEN** a book added on a laptop has been published and the user opens the site on a phone
- **THEN** the phone's shelf shows that book with the same spine

#### Scenario: Persistence
- **WHEN** the user closes every browser and returns weeks later
- **THEN** all books not deleted are still on the shelf

### Requirement: Reading without a token
Anyone opening the site SHALL see the shelf and be able to read books using only the published site, without any GitHub credentials.

#### Scenario: Fresh browser
- **WHEN** the site is opened in a private window with no stored token
- **THEN** the shelf loads from the published manifest and books open in the reader

### Requirement: GitHub connection
Adding, deleting, and syncing positions SHALL require connecting the library once per device by pasting a fine-grained personal access token. The token SHALL be stored only in that browser, never committed or sent anywhere except the GitHub API, and SHALL be removable.

#### Scenario: First add on a device
- **WHEN** the user presses "Add to shelf" on a device that is not connected
- **THEN** a "Connect your library" dialog asks for the token, with the repository prefilled from the site address

#### Scenario: Token verification
- **WHEN** the user submits a token that lacks write access to the repository
- **THEN** the dialog says the token can't write to the repository and how to fix its permissions

#### Scenario: Disconnect
- **WHEN** the user chooses "Disconnect" in library settings
- **THEN** the token is erased from the device and write actions require reconnecting

### Requirement: Atomic library writes
Each add or delete SHALL be recorded as a single commit that changes both the book file and the manifest. Concurrent writes from different devices SHALL NOT lose either change.

#### Scenario: Add commit
- **WHEN** a book is added
- **THEN** one commit adds the file and the updated manifest together

#### Scenario: Concurrent edits
- **WHEN** two devices each add a book at nearly the same time
- **THEN** both books end up in the manifest

### Requirement: Fresh view after changes
Changes made on a device SHALL appear on that device immediately, before the site redeploys, and SHALL appear on other devices once the redeploy finishes.

#### Scenario: Just added
- **WHEN** the user adds a book and reloads the page before the redeploy has finished
- **THEN** the book is still on the shelf and opens from the local cache

#### Scenario: Stale published manifest
- **WHEN** the published manifest has not yet caught up with a connected device's latest commit
- **THEN** that device shows the latest library state

### Requirement: Local file cache
Opened and added book files SHALL be cached on the device so that reopening a book does not download it again. If the cache is cleared or full, books SHALL still open by downloading them.

#### Scenario: Reopen offline-cached book
- **WHEN** the user reopens a previously opened book
- **THEN** it loads from the local cache without a network request for the file

#### Scenario: Storage full
- **WHEN** the device runs out of cache space
- **THEN** the least recently opened books are evicted from the cache and the new book is still opened

### Requirement: Local position save
The reader SHALL save the current position on the device on every page turn.

#### Scenario: Tab closed mid-book
- **WHEN** the user turns to page 50 and closes the tab immediately
- **THEN** reopening the book on that device opens at page 50

### Requirement: Debounced position sync
On connected devices, positions SHALL sync to the manifest when the user leaves the reader or hides the page, and at most once every five minutes while reading, never once per page turn. When local and synced positions differ, the most recently updated one SHALL win.

#### Scenario: Leaving the reader
- **WHEN** a connected user reads 30 pages and returns to the shelf
- **THEN** at most one commit records the new position

#### Scenario: Continue on another device
- **WHEN** the user reads to chapter 9 on a laptop, returns to the shelf, and later opens the book on a connected phone after the sync published
- **THEN** the phone opens at chapter 9

#### Scenario: Unconnected device
- **WHEN** the user reads on a device with no token
- **THEN** positions save locally only and no sync is attempted

### Requirement: Deletion
Deleting a book SHALL remove its file and manifest entry from the repository and its cached data from the device.

#### Scenario: Deleted book on another device
- **WHEN** a book is deleted on one device and the site redeploys
- **THEN** other devices no longer show it and drop its cached file on next load

### Requirement: Public visibility notice
Before the first upload on a device, the user SHALL be told that files stored in the library are publicly downloadable by anyone with the link and stay in the repository's history after deletion.

#### Scenario: Connect dialog notice
- **WHEN** the "Connect your library" dialog is shown
- **THEN** it states that added books are public and remain in the repository's history

### Requirement: Search engine exclusion
The published library SHALL ask search engines not to index the site or its book files.

#### Scenario: Crawler visit
- **WHEN** a crawler requests the site
- **THEN** the page carries a noindex directive and `robots.txt` disallows the library directory
