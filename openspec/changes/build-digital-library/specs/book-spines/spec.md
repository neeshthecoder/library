# Spec Delta

## Purpose

Defines how each book's spine looks: colors inferred from the embedded cover when one exists, otherwise one of three ornamental trim designs, with a legible, contrast-safe vertical title.

## ADDED Requirements

### Requirement: Spine source priority
A book's spine SHALL default to a cover-derived design when a cover image was found in the file, and SHALL otherwise default to a trim design. The user's choice in the import preview SHALL override the default and SHALL be stored with the book.

#### Scenario: EPUB with a cover
- **WHEN** an EPUB declaring a cover image is imported
- **THEN** the preview defaults to the "From cover" spine

#### Scenario: File without a cover
- **WHEN** a MOBI file with no cover record is imported
- **THEN** the preview offers no "From cover" option and defaults to a randomly chosen trim design

### Requirement: Cover sources
The system SHALL treat as the cover the EPUB's declared cover image, the MOBI/AZW3 cover record, or the rendered first page of a PDF.

#### Scenario: PDF cover
- **WHEN** a PDF is imported
- **THEN** its first page is rendered and used as the cover for color inference

### Requirement: Cover-derived spine
A cover-derived spine SHALL be a flat illustration using the cover's dominant color as the background and a contrasting accent color from the cover for its bands and bookmark. It SHALL NOT attempt to reproduce real spine artwork.

#### Scenario: Colors extracted
- **WHEN** a cover that is mostly dark green with orange lettering is imported
- **THEN** the spine background is the dark green and the accent is the orange

#### Scenario: Monochrome cover
- **WHEN** the cover has no distinct second color
- **THEN** the accent is derived from the dominant color so that it is visibly distinct from the background

### Requirement: Three trim designs
The system SHALL provide three ornamental trim designs recreated from `design/spine-trims.png` as scalable inline SVG: a rectilinear frame with side tabs and diamond finials, a label plate with star medallion and lattice-and-leaf foot, and arched fleuron caps with an ogee panel and four-point sparkles. Each SHALL take its background and trim colors as variables.

#### Scenario: Recoloring a trim
- **WHEN** the background or trim color of a trim spine is changed
- **THEN** the same design re-renders in the new colors without any raster image

#### Scenario: Scaling without distortion
- **WHEN** a trim spine is rendered at different heights and widths
- **THEN** its ornaments keep their proportions and only the central title panel stretches

### Requirement: Random harmonious colors
For trim spines the system SHALL randomly choose a design and generate a background and trim color pair that is harmonious and high contrast. The trim color SHALL have at least 3:1 contrast against the background.

#### Scenario: Generated pair
- **WHEN** a new trim spine is generated
- **THEN** its trim-to-background contrast ratio is at least 3:1

#### Scenario: Shuffle
- **WHEN** the user presses "Shuffle colors" in the preview
- **THEN** a new pair meeting the same contrast rule is applied

### Requirement: Vertical title in the middle panel
The title SHALL be set in the sans, rotated to run vertically inside the spine's middle panel, reading top to bottom.

#### Scenario: Title placement
- **WHEN** any spine renders
- **THEN** the title sits within the middle panel and does not overlap ornaments or bands

### Requirement: Title auto-fit and truncation
The title SHALL be sized as large as fits the panel, down to a minimum legible size, and MAY wrap to two lines before being shortened. Only if it still does not fit SHALL it be truncated with an ellipsis.

#### Scenario: Short title
- **WHEN** the title is "Emma"
- **THEN** it renders at the largest size the panel width allows

#### Scenario: Very long title
- **WHEN** the title does not fit on two lines at the minimum size
- **THEN** it is truncated with an ellipsis and the full title remains available as the spine's accessible name and tooltip

### Requirement: Title contrast
The title color SHALL meet WCAG AA contrast of at least 4.5:1 against the spine background, regardless of which colors the user picks.

#### Scenario: User picks a mid-tone background
- **WHEN** the user picks a background where the trim color would fail 4.5:1 for text
- **THEN** the title switches to a light or dark ink that passes 4.5:1

### Requirement: Stable spine dimensions
Each spine's width SHALL reflect the book's length (page count or estimated pages) within a bounded range, with small stable variation, and its height SHALL vary within a bounded range derived deterministically from the book's identity. No spine SHALL be narrower than a 44 px touch target.

#### Scenario: Long vs short book
- **WHEN** a 900-page book and a 90-page book are on the shelf
- **THEN** the longer book's spine is wider

#### Scenario: Minimum width
- **WHEN** a very short book is shown on a small screen
- **THEN** its spine is at least 44 px wide

### Requirement: Spine shape
Spines SHALL be flat, slightly cartoony shapes with soft rounded corners, no textures, no gradients, and no shadows.

#### Scenario: Rendering style
- **WHEN** any spine is rendered
- **THEN** it uses only flat fills with rounded corners and no shadow
