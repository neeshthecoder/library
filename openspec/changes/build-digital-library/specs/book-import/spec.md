# Spec Delta

## Purpose

Lets the user add books by dragging files onto the window or choosing them with a file picker, validates them, and confirms each one through a preview dialog before it joins the shelf.

## ADDED Requirements

### Requirement: Whole-window drag overlay
While files are dragged over the browser window, the site SHALL show a full-window overlay with a dashed outline and the text "Drag file here". The overlay SHALL not flicker as the drag crosses child elements and SHALL hide on drop, on cancel, or when the drag leaves the window.

#### Scenario: Drag enters
- **WHEN** the user drags a file from the desktop into the window
- **THEN** the overlay appears immediately

#### Scenario: Crossing elements
- **WHEN** the dragged file moves across spines, the headline, and buttons
- **THEN** the overlay stays visible without flickering

#### Scenario: Drag leaves the window
- **WHEN** the user drags the file back out of the window
- **THEN** the overlay hides

#### Scenario: Non-file drag
- **WHEN** the user drags selected text or a link within the page
- **THEN** no overlay appears

#### Scenario: Drop on the reader
- **WHEN** the user drops a book while the reader is open
- **THEN** the import preview opens for that file

### Requirement: File picker import
The "Add book" button SHALL open a file picker that accepts multiple files, and chosen files SHALL follow the same validation and preview flow as dropped files.

#### Scenario: Picker selection
- **WHEN** the user picks two EPUB files with the picker
- **THEN** both are queued for preview

### Requirement: Supported formats
The system SHALL accept PDF, EPUB, MOBI, and AZW3 files, identified by file signature rather than extension alone. Other files SHALL be rejected with a plain message naming the supported formats.

#### Scenario: Unsupported file
- **WHEN** the user drops `notes.docx`
- **THEN** the message "That file type isn't supported. Add a PDF, EPUB, MOBI, or AZW3 file." is shown and nothing is added

#### Scenario: Misnamed file
- **WHEN** a valid EPUB is named `book.zip`
- **THEN** it is accepted as an EPUB

### Requirement: File size limit
Files larger than 100 MB SHALL be rejected before any upload with a message stating the file's size and the limit.

#### Scenario: Oversized file
- **WHEN** the user drops a 140 MB PDF
- **THEN** the message "This file is 140 MB. The limit is 100 MB." is shown and nothing is uploaded

#### Scenario: Library nearly full
- **WHEN** adding a file would push the library over 1 GB
- **THEN** the user is told the library would exceed its storage limit and the file is not added

### Requirement: DRM and password detection
The system SHALL detect DRM-protected EPUB, MOBI, AZW3, and PDF files and password-protected PDFs, and SHALL tell the user clearly instead of failing silently. Font obfuscation in EPUBs SHALL NOT be treated as DRM.

#### Scenario: DRM EPUB
- **WHEN** the user drops an EPUB whose content files are encrypted
- **THEN** the message "This book is DRM-protected, so it can't be opened here. Add a DRM-free copy." is shown and nothing is added

#### Scenario: Encrypted MOBI
- **WHEN** the user drops a MOBI whose header marks it as encrypted
- **THEN** the same DRM message is shown

#### Scenario: Password-protected PDF
- **WHEN** the user drops a PDF that requires a password to open
- **THEN** the message "This PDF needs a password to open. Add an unlocked copy." is shown

#### Scenario: EPUB with obfuscated fonts only
- **WHEN** an EPUB encrypts only embedded fonts using the IDPF or Adobe font obfuscation algorithm
- **THEN** it is accepted normally

### Requirement: Title prefill from metadata
The preview's title SHALL be prefilled from the file's metadata (EPUB package title, MOBI/AZW3 header or EXTH title, PDF document-info or XMP title). Missing or placeholder metadata titles SHALL fall back to a cleaned-up filename.

#### Scenario: EPUB title
- **WHEN** an EPUB's package metadata has title "Middlemarch"
- **THEN** the title field shows "Middlemarch"

#### Scenario: Junk PDF title
- **WHEN** a PDF's metadata title is "Microsoft Word - draft3.docx" and the filename is `the_left-hand_of_darkness (2).pdf`
- **THEN** the title field shows "The left hand of darkness"

### Requirement: Preview dialog
Each accepted file SHALL open a modal preview dialog containing a live spine preview at real shelf proportions, an editable title field, a spine source choice, trim controls when a trim is chosen, a primary "Add to shelf" button, and a secondary "Cancel" button.

#### Scenario: Live preview
- **WHEN** the user edits the title or changes any spine option
- **THEN** the spine preview updates immediately

#### Scenario: Spine source choice
- **WHEN** a cover was found
- **THEN** the source choice offers "From cover" and the three trim designs; otherwise only the three trims

#### Scenario: Trim controls
- **WHEN** a trim design is selected
- **THEN** the dialog shows background color and trim color pickers and a "Shuffle colors" button

#### Scenario: Empty title
- **WHEN** the user clears the title field and presses "Add to shelf"
- **THEN** the dialog shows "Add a title." next to the field and does not add the book

#### Scenario: Cancel
- **WHEN** the user presses "Cancel" or Escape
- **THEN** the dialog closes and that file is not added

#### Scenario: Focus management
- **WHEN** the dialog opens
- **THEN** focus moves to the title field, is trapped in the dialog, and returns to the previously focused element on close

### Requirement: Multi-file queue
When several files are added at once, the system SHALL validate all of them, report rejected files, and preview the accepted files one at a time in the order they were added.

#### Scenario: Three files dropped
- **WHEN** the user drops two EPUBs and one DOCX
- **THEN** the DOCX is rejected with a message and the two EPUBs are previewed one after another, each showing its position, such as "Book 1 of 2"

#### Scenario: Cancel one in the queue
- **WHEN** the user cancels the first of two queued books
- **THEN** the second book's preview opens next

### Requirement: Adding to the shelf
Pressing "Add to shelf" SHALL place the book on the shelf immediately and store it permanently, showing progress while it uploads and a retry option if storing fails.

#### Scenario: Successful add
- **WHEN** the user presses "Add to shelf"
- **THEN** the spine appears on the shelf right away and becomes permanent once the upload finishes

#### Scenario: Upload fails
- **WHEN** the upload fails because the network is offline
- **THEN** the book stays on this device's shelf marked as not uploaded, with a "Retry upload" action
