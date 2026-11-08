# Styleguide

This file governs how this application looks, reads, and performs. Follow it for every UI change. When a request conflicts with this guide, follow the request and note the deviation in your reply.

The direction is civic and calm, not decorative: a quiet, warm paper surface, dark slate ink, one condensed editorial serif used large, and a plain grotesque doing all the work underneath. Confidence comes from scale, tight spacing, and restraint, never from ornament.

---

## 1. Principles

1. **Type is the visual.** The serif headline or number is the hero of each screen. No hero illustrations, stock photography, gradient blobs, or icon grids to fill space.
2. **One signature moment per screen.** One large serif element per view. Everything around it is small, quiet sans.
3. **Two roles, never mixed.** The serif speaks (headlines, big numbers, section titles). The sans works (body, UI, labels, buttons, legal text). Never set buttons, form fields, or body copy in the serif.
4. **Tight, not cramped.** Large type is set with negative tracking and leading near 1.0. Small type gets normal tracking and generous leading.
5. **Calm surfaces.** Warm off-white page, slightly darker cards, no borders, no hairline rules, almost no shadows.
6. **Navy means action.** The navy fill is reserved for the primary action and the selected state. If everything is navy, nothing is.
7. **Plain words.** Short declarative sentences. Sentence case everywhere.

---

## 2. Color tokens

Sampled from the reference screenshots. Use the tokens, never raw hex in components.

| Token | Hex | Use |
|---|---|---|
| `--paper` | `#F8F6F1` | Page background |
| `--linen` | `#F1EEE7` | Cards, segmented-control track, hero band, inputs |
| `--ink` | `#232C32` | Headlines, big numbers, primary text |
| `--ink-muted` | `#49565F` | Secondary text, unselected tabs, disclaimers |
| `--navy` | `#303A4E` | Primary buttons, selected states, focus ring |
| `--navy-hover` | `#262F41` | Hover/pressed for navy fills |
| `--midnight` | `#0F172F` | Inverse sections (full-bleed dark bands) |
| `--on-dark` | `#FFFFFF` | Text on navy and midnight |
| `--on-dark-muted` | `#B9C0CC` | Secondary text on midnight |
| `--danger` | `#9B2C2C` | Errors only |
| `--success` | `#2F5D46` | Confirmations only |

```css
:root {
  --paper: #F8F6F1;
  --linen: #F1EEE7;
  --ink: #232C32;
  --ink-muted: #49565F;
  --navy: #303A4E;
  --navy-hover: #262F41;
  --midnight: #0F172F;
  --on-dark: #FFFFFF;
  --on-dark-muted: #B9C0CC;
  --danger: #9B2C2C;
  --success: #2F5D46;
}
```

Rules:
- No other accent colors. No red/white/blue flourishes, gold, gradients, or tints of the palette invented on the fly.
- Text is never pure black. Use `--ink`.
- Dark mode (if built) swaps to the inverse section palette: `--midnight` page, a slightly lighter `#18213B` for cards, `--on-dark` text, and `--paper` as the action fill with `--ink` text.
- All text must meet WCAG AA (4.5:1 body, 3:1 for 24px+). The palette above passes; verify any new pairing.

---

## 3. Typography

### Families

| Role | Family | Fallback stack |
|---|---|---|
| Display serif | **Instrument Serif**, 400 only | `"Instrument Serif", "Times New Roman", Georgia, serif` |
| Sans (UI + body) | **Inter** (variable, 400/500/600) | `Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif` |

The serif is condensed and high-contrast, and it only has one weight. Never fake bold or italic on it. Emphasis in serif text comes from size, not weight.

The sans in the reference may not be Inter exactly. If a closer match is identified, swap it in this table only; nothing else changes. To make the product less recognizable as an NDS copy, the approved alternates are Newsreader Display or Fraunces (condensed setting) for the serif, and Geist or IBM Plex Sans for the sans. Change one, not both.

### Scale

Fluid sizes using `clamp()`. Values are min / preferred / max.

| Token | Family | Size | Line height | Tracking | Use |
|---|---|---|---|---|---|
| `display-xl` | Serif | `clamp(3.5rem, 9vw, 8rem)` | 0.95 | -0.025em | Hero headline, one per page |
| `display-lg` | Serif | `clamp(3rem, 7vw, 6rem)` | 1.0 | -0.03em | Big numbers / stats |
| `display-md` | Serif | `clamp(2.5rem, 5vw, 4.5rem)` | 1.0 | -0.02em | Section titles (e.g. "Gallery") |
| `heading` | Sans 500 | `clamp(1.75rem, 3vw, 2.75rem)` | 1.12 | -0.015em | Statements, sub-sections |
| `title` | Sans 600 | 1.25rem | 1.3 | -0.01em | Card titles, dialog titles |
| `body-lg` | Sans 400 | 1.25rem | 1.5 | -0.005em | Lead paragraphs, card captions |
| `body` | Sans 400 | 1rem | 1.55 | 0 | Default text |
| `ui` | Sans 500 | 1rem | 1 | 0 | Buttons, tabs |
| `fine` | Sans 400 | 0.875rem | 1.5 | 0.005em | Disclaimers, footnotes |

Rules:
- Serif sizes never go below `display-md`. Under ~40px the condensed serif loses its character; use the sans instead.
- Big numbers use the serif with tight tracking and proportional figures. Abbreviate large values (`$13M`, not `$13,000,000`). Data tables and inline figures use the sans with `font-variant-numeric: tabular-nums`.
- Inline emphasis inside sans copy uses weight 600 on the value only: "Contributing **$250/year**". No color changes, no italics, no underlines for emphasis.
- No all-caps labels, no eyebrow text above headings, no letter-spaced kickers.
- Headlines end with a period when they are sentences ("The American Dream starts now.").
- Max line length: 65ch for body, 20ch for display headlines (break lines deliberately with `text-wrap: balance`).
- Apply `font-feature-settings: "kern"` and `text-rendering: optimizeLegibility` to display sizes only.

---

## 4. Layout and spacing

- Spacing scale (rem): `0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12`. Use nothing in between.
- Content max width: `72rem`. Text columns: `40rem`.
- Section vertical padding: `clamp(4rem, 10vw, 8rem)`. Sections breathe; never stack dense blocks.
- Alignment: hero headlines, stats, and inverse section titles are centered. Statements with a call to action, body copy, and forms are left-aligned. Don't center paragraphs longer than three lines.
- Grids: stat cards in a 3-up grid on desktop, 1-up on mobile (not 2-up). Gap `1rem` to `1.5rem`.
- Inverse (`--midnight`) sections are full-bleed bands, used at most once or twice per page to mark a shift (e.g. Gallery).

---

## 5. Shape and depth

| Token | Value | Use |
|---|---|---|
| `--radius-card` | `2rem` | Cards, panels, large surfaces |
| `--radius-input` | `1rem` | Inputs, small panels |
| `--radius-pill` | `999px` | Buttons, segmented controls, chips |

- No borders on cards. Separation comes from `--linen` against `--paper`.
- Only one shadow exists: `0 2px 8px rgba(35, 44, 50, 0.12)`, used on the selected segment of a segmented control and on floating menus. Cards have no shadow.
- No hairline dividers. Use space.

---

## 6. Components

### Primary button
- Pill, `--navy` fill, `--on-dark` text, sans 600 at 1rem.
- Height 48px, horizontal padding 1.75rem. Hover `--navy-hover`. Pressed: scale 0.98.
- Label is a plain verb that says what happens ("Participate", "Open account", "Save changes"). No arrows or icons appended.
- One primary button per view.

### Secondary button
- Pill, transparent, `--ink` text, 1.5px inset ring in `--ink` at 20% opacity. Same size as primary.

### Segmented control (tabs)
- Track: `--linen`, pill, 6px inner padding.
- Unselected: `--ink-muted` text, no fill.
- Selected: `--navy` fill, `--on-dark` text, the single shadow.
- The selected pill slides between options (200ms, ease-out). Use `role="tablist"` / `role="tab"` with arrow-key navigation.

### Stat card
```
┌───────────────────────────┐
│                           │
│         $878,000          │  ← serif display-lg, --ink, centered
│                           │
│  Contributing $250/year   │  ← sans body-lg, value in 600
│                           │
└───────────────────────────┘
```
- `--linen` background, `--radius-card`, padding `3rem 2rem`.
- When values change (e.g. switching tabs), crossfade numbers (150ms) rather than counting up.

### Statement block
- Sans `heading`, `--ink`, left-aligned, max 22ch, followed by `3rem` of space and a primary button.

### Inverse section header
- Full-bleed `--midnight` band, serif `display-md` in `--on-dark`, centered, generous padding.

### Disclaimer / fine print
- Sans `fine`, `--ink-muted`, centered under the content it qualifies, max 60ch. Always present beneath projections, estimates, or financial figures.

### Inputs
- `--linen` fill, no border, `--radius-input`, height 52px, sans `body`. Focus: 2px `--navy` ring with 2px offset. Labels above fields in sans 500, sentence case.

---

## 7. Motion

- Motion responds to the user (tab switches, opening, confirming). No scroll-triggered fade-ins on every section, no parallax, no auto-playing carousels.
- At most one orchestrated entrance per page: the hero headline may fade in (400ms, opacity only, no slide).
- Durations: 150ms (state changes), 200ms (movement), 300ms max.
- Easing: `cubic-bezier(0.2, 0, 0, 1)`.
- Animate only `opacity` and `transform`.
- Respect `prefers-reduced-motion: reduce` by removing all non-essential animation.

---

## 8. Imagery and iconography

- Photography is documentary and natural-light, full-bleed or inside `--radius-card` frames. No stock-photo poses, no duotone filters.
- Icons: a single outline set (e.g. Lucide) at 1.5px stroke, sized to the adjacent text. Use icons only where they clarify a control, never as decoration beside headings.
- No flags, eagles, stars, or national iconography as decoration.

---

## 9. Writing

- Sentence case everywhere, including buttons and navigation.
- Short, declarative, active voice. One idea per sentence.
- Name things by what the user does, not how the system works.
- Errors say what happened and how to fix it. They don't apologize.
- Numbers: abbreviate large values in displays (`$1.3M`), write in full in body text and legal copy.
- Any projected or illustrative figure carries a disclaimer.

---

## 10. Performance

Pages should feel instant. Treat these as requirements, not goals.

- **Budgets (mobile, 4G):** LCP < 2.0s, CLS < 0.05, INP < 200ms. JS per route < 150KB gzipped.
- **Fonts:** self-host (or use `next/font` if on Next.js). Subset to Latin. Load Instrument Serif 400 and Inter variable as WOFF2 only. Preload the serif, since it is usually the LCP element. Use `font-display: swap` with metric-matched fallbacks (`size-adjust`, `ascent-override`) so swapping causes no layout shift.
- **Images:** AVIF/WebP with explicit `width`/`height`, `loading="lazy"` below the fold, `fetchpriority="high"` on the hero image if one exists.
- **Video:** hero video is muted, `playsinline`, has a poster frame, and is under 3MB; never block content on it.
- **CSS:** tokens as CSS custom properties; no runtime CSS-in-JS. Avoid large UI libraries for components defined here.
- **Rendering:** server-render content; hydrate only interactive pieces (segmented controls, forms).

---

## 11. Accessibility

- WCAG 2.2 AA minimum.
- Every interactive element has a visible focus state (2px `--navy` ring, 2px offset; `--on-dark` ring on midnight).
- Touch targets at least 44×44px.
- Big numbers have accessible text that reads correctly (`aria-label="13 million dollars"` when abbreviated).
- Headlines are real heading elements in order; don't skip levels for visual size.
- Layout holds at 200% zoom and 320px width.

---

## 12. Don't

- Bold, italic, or small sizes of the serif.
- More than one serif display element competing on a screen.
- Borders, hairlines, or drop shadows on cards.
- All-caps labels, eyebrows, numbered markers (01 / 02) on non-sequential content.
- Gradients, glows, glassmorphism, or decorative blobs.
- Accent colors outside the token table.
- Arrows appended to button labels.
- Emoji in the interface.
- Count-up number animations or scroll-reveal on every section.

---

## 13. Review checklist

Before finishing any UI task, confirm:

- [ ] Only token colors are used.
- [ ] Serif appears only at `display-md` or larger, at weight 400.
- [ ] Exactly one primary (navy) action per view.
- [ ] Cards are `--linen` on `--paper`, no borders, no shadows.
- [ ] Copy is sentence case, active, and plain.
- [ ] Focus states visible; reduced motion respected; contrast passes.
- [ ] Fonts preloaded with metric-matched fallbacks; no layout shift on load.
- [ ] Layout checked at 320px, 768px, and 1440px.
