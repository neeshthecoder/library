# Spec Delta

## ADDED Requirements

### Requirement: Spine title font
Each book SHALL store one title font from a fixed list: Instrument Serif, EB Garamond, Cardo, TeX Gyre Pagella, Cormorant Garamond and Crimson Pro. The spine's title and author SHALL render in that font. A book with no stored font SHALL use Instrument Serif. All fonts SHALL be served by the site itself.

#### Scenario: Chosen font
- **GIVEN** a book whose font is EB Garamond
- **WHEN** its spine renders
- **THEN** the title and author are set in EB Garamond

#### Scenario: Older book
- **GIVEN** a book added before font choice existed
- **WHEN** its spine renders
- **THEN** it looks exactly as it did before, in Instrument Serif

#### Scenario: Unknown font value
- **GIVEN** a manifest entry names a font that isn't in the list
- **WHEN** its spine renders
- **THEN** it uses Instrument Serif

#### Scenario: Fit after the font loads
- **GIVEN** a spine's font hasn't downloaded yet
- **WHEN** it finishes loading
- **THEN** the title is re-fitted for that font, so it never overflows the panel

### Requirement: Author line
When a book has an author, the spine SHALL show it under the title in the same font at a smaller size, centered in the middle panel and in the title's ink color. When a book has no author, the title SHALL use the whole panel as before.

#### Scenario: Title and author
- **GIVEN** "The Left Hand of Darkness" by "Ursula K. Le Guin"
- **WHEN** its spine renders
- **THEN** the author appears below the title in smaller text, inside the middle panel

#### Scenario: No author
- **GIVEN** a book with no author
- **WHEN** its spine renders
- **THEN** only the title is shown, at the same size as before this change

#### Scenario: Accessible name
- **GIVEN** a book with an author
- **WHEN** a screen reader focuses its spine
- **THEN** the spine's accessible name gives the title followed by the author ("Emma, Jane Austen", so it contains the visible text) and its tooltip reads "Emma by Jane Austen"

## MODIFIED Requirements

### Requirement: Title auto-fit and truncation
The title SHALL be sized as large as fits the panel, down to a minimum legible size, and MAY wrap to two lines before being shortened. Only if it still does not fit SHALL it be truncated with an ellipsis. When an author is present, it SHALL wrap onto as many lines as it needs below the title and SHALL never be shortened with an ellipsis. The author SHALL never cause the title to be truncated: it SHALL shrink (11, then 10, then 9 px) to make room, and SHALL be dropped from the spine (but kept in the accessible name) if even that would cut the title short.

#### Scenario: Short title
- **WHEN** the title is "Emma"
- **THEN** it renders at the largest size the panel width allows

#### Scenario: Very long title
- **WHEN** the title does not fit on two lines at the minimum size
- **THEN** it is truncated with an ellipsis and the full title remains available as the spine's accessible name and tooltip

#### Scenario: Long author
- **WHEN** the author is "Gabriel García Márquez" on a narrow spine
- **THEN** the author wraps onto two or more lines under the title, in full, with no ellipsis

#### Scenario: Short spine
- **WHEN** the panel can't fit the whole title and the wrapped author, even at 9 px
- **THEN** the title is shown and the author is left off the spine
