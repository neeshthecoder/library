import type { SpineSettings } from '../storage/manifest'
import { hexToOklch, oklchToHex } from './color'
import { ensureContrast, SHELF_BACK } from './contrast'
import { spinePx } from './geometry'
import { renderSpineArt } from './trims'
import { fontFor } from './fonts'
import { cleanAuthor } from '../storage/manifest'
import { fitTitle, LINE_HEIGHT, MIN_SIZE, SOFT_HYPHEN, truncate, type Measure } from './title-fit'

/** The author line's size (px): below the title's minimum, so it always reads as secondary. */
export const AUTHOR_SIZE = 11
/** Space between the title and the author line (px). */
export const AUTHOR_GAP = 4

export interface SpineModel {
  id: string
  title: string
  /** Shown under the title when set. */
  author?: string | null
  spine: SpineSettings
  /** Show the bookmark ribbon. */
  started: boolean
}

/** A flat band 6% lighter than the background (illustration only). */
export function bandColor(bg: string): string {
  const [L, C, H] = hexToOklch(bg)
  return oklchToHex([Math.min(1, L + 0.03), C, H])
}

/** Ribbon color: the band color, lightened if needed to stay visible against the dark back wall. */
export const ribbonColor = (trim: string) => ensureContrast(trim, SHELF_BACK, 3)

const RIBBON_SVG =
  '<svg viewBox="0 0 10 24" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
  '<path d="M1,0 L9,0 Q10,0 10,1 L10,24 L0,24 L0,1 Q0,0 1,0Z M0,0 L5,5 L10,0Z" fill-rule="evenodd" fill="var(--ribbon)"/></svg>'

/** Applies color custom properties; recoloring never re-renders the SVG. */
export function applySpineColors(el: HTMLElement, s: Pick<SpineSettings, 'bg' | 'trim' | 'ink'>): void {
  el.style.setProperty('--bg', s.bg)
  el.style.setProperty('--trim', s.trim)
  el.style.setProperty('--band', bandColor(s.bg))
  el.style.setProperty('--title-ink', s.ink)
  el.style.setProperty('--ribbon', ribbonColor(s.trim))
}

/**
 * Renders spine art, title and optional ribbon into `el` (usually a button).
 * Sizes come from the stored height/width fractions and the shelf height.
 * `measure` must measure in the spine's font (see fontMeasures).
 */
export function renderSpine(el: HTMLElement, model: SpineModel, shelfPx: number, measure: Measure): void {
  const { width, height } = spinePx(model.spine.h, model.spine.w, shelfPx)
  el.style.width = `${width}px`
  el.style.height = `${height}px`
  applySpineColors(el, model.spine)
  const art = renderSpineArt(model.spine, width, height)
  // Reserve one author line under the title, unless the panel is too short
  // for both: then the author is left off (it stays in the accessible name).
  let author = cleanAuthor(model.author)
  let titleHeight = art.panel.height
  const reserve = AUTHOR_SIZE * LINE_HEIGHT + AUTHOR_GAP
  if (author && titleHeight - reserve >= MIN_SIZE * LINE_HEIGHT) titleHeight -= reserve
  else author = null
  const fit = fitTitle(model.title, art.panel.width, titleHeight, measure)

  el.innerHTML = ''
  if (model.started) {
    const ribbon = document.createElement('span')
    ribbon.className = 'spine-ribbon'
    ribbon.setAttribute('aria-hidden', 'true')
    ribbon.style.width = `${Math.max(8, Math.round(width * 0.2))}px`
    ribbon.innerHTML = RIBBON_SVG
    el.append(ribbon)
  }
  el.insertAdjacentHTML('beforeend', art.svg)

  const title = document.createElement('span')
  title.className = 'spine-title'
  title.setAttribute('aria-hidden', 'true')
  Object.assign(title.style, {
    left: `${art.panel.x}px`,
    top: `${art.panel.y}px`,
    width: `${art.panel.width}px`,
    height: `${art.panel.height}px`,
    fontSize: `${fit.size}px`,
    lineHeight: String(LINE_HEIGHT),
  })
  const font = fontFor(model.spine.font)
  title.style.fontFamily = font.stack
  title.style.fontWeight = String(font.weight)
  el.dataset.font = font.id
  fit.lines.forEach((text, i) => {
    const soft = text.endsWith(SOFT_HYPHEN)
    // Real spaces between lines keep the text matching the title for
    // assistive tech; none after a hyphen, real or inserted.
    const prev = fit.lines[i - 1]
    if (prev && !prev.endsWith('-') && !prev.endsWith(SOFT_HYPHEN)) title.append(' ')
    const line = document.createElement('span')
    line.className = soft ? 'spine-title-line soft-break' : 'spine-title-line'
    line.textContent = soft ? text.slice(0, -1) : text
    title.append(line)
  })
  if (author) {
    const by = document.createElement('span')
    by.className = 'spine-author'
    by.style.fontSize = `${AUTHOR_SIZE}px`
    by.style.marginTop = `${AUTHOR_GAP}px`
    by.textContent = truncate(author, AUTHOR_SIZE, art.panel.width, measure)
    title.append(' ', by) // a real space, so the visible text reads "Title Author"

  }
  el.append(title)
  el.dataset.truncated = String(fit.truncated)
}
