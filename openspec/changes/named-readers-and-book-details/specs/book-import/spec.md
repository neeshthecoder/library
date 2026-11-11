# Spec Delta

## MODIFIED Requirements

### Requirement: Preview dialog
Each accepted file SHALL open a modal preview dialog containing a live spine preview at real shelf proportions, an editable title field, an optional author field, a font choice, a spine source choice, trim controls when a trim is chosen, a primary "Add to shelf" button, and a secondary "Cancel" button.

#### Scenario: Live preview
- **WHEN** the user edits the title or author, picks a font, or changes any spine option
- **THEN** the spine preview updates immediately

#### Scenario: Font choice
- **WHEN** the dialog opens
- **THEN** the font choice lists Instrument Serif, EB Garamond, Cardo, TeX Gyre Pagella, Cormorant Garamond and Crimson Pro, each name shown in its own font, with Instrument Serif selected

#### Scenario: Author optional
- **WHEN** the user leaves the author field empty and presses "Add to shelf"
- **THEN** the book is added with no author

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

## ADDED Requirements

### Requirement: Author prefill from metadata
The preview's author field SHALL be prefilled from the file's metadata (EPUB creators, MOBI/AZW3 author, PDF document-info author or XMP creator). Several authors SHALL be joined with ", ". When no author is found, the field SHALL be empty. Whitespace SHALL be collapsed and the saved author SHALL be at most 120 characters.

#### Scenario: EPUB author
- **WHEN** an EPUB's package metadata lists creator "George Eliot"
- **THEN** the author field shows "George Eliot"

#### Scenario: Two authors
- **WHEN** an EPUB lists creators "Terry Pratchett" and "Neil Gaiman"
- **THEN** the author field shows "Terry Pratchett, Neil Gaiman"

#### Scenario: No author metadata
- **WHEN** a PDF has no author in its metadata
- **THEN** the author field is empty
