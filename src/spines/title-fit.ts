/** Measures the advance width of `text` at `size` px. */
export type Measure = (text: string, size: number) => number

export interface FitResult {
  /** Lines as displayed. A line ending in SOFT_HYPHEN was broken mid-word. */
  lines: string[]
  size: number
  truncated: boolean
}

/** Marks a hyphen the fitter inserted (not part of the title). Rendered via CSS. */
export const SOFT_HYPHEN = '\u00AD'

export const MAX_SIZE = 20
export const MIN_SIZE = 12
export const LINE_HEIGHT = 1.1
const STEP = 0.5
const HYPHEN = '-' // measured width of an inserted hyphen

/** Splits a word that's too wide into hyphenated pieces that fit. */
function breakWord(word: string, size: number, width: number, measure: Measure): string[] {
  const parts: string[] = []
  let rest = word
  while (measure(rest, size) > width && rest.length > 1) {
    let n = rest.length - 1
    while (n > 1 && measure(rest.slice(0, n) + HYPHEN, size) > width) n-- // a soft hyphen renders as '-'
    parts.push(rest.slice(0, n) + SOFT_HYPHEN)
    rest = rest.slice(n)
  }
  parts.push(rest)
  return parts
}

/**
 * Splits text into wrap units. Spaces separate words; an existing hyphen is
 * also a break point ("Chaise-" | "Longue"), joined back without a space.
 */
function tokens(text: string): { text: string; glue: string }[] {
  const out: { text: string; glue: string }[] = []
  text.split(' ').forEach((word, i) => {
    const parts = word.split(/(?<=[^\s-]-)(?=[^-])/)
    parts.forEach((p, j) => out.push({ text: p, glue: j > 0 ? '' : i > 0 ? ' ' : '' }))
  })
  return out
}

/** Greedy word wrap. Breaks at spaces and existing hyphens; hyphenates words wider than the line. */
export function wrap(text: string, size: number, width: number, measureRaw: Measure): { lines: string[]; broke: boolean } {
  const measure = withSoftHyphen(measureRaw)
  const lines: string[] = []
  let broke = false
  let line = ''
  for (const tok of tokens(text)) {
    const candidate = line ? line + tok.glue + tok.text : tok.text
    if (measure(candidate, size) <= width) {
      line = candidate
      continue
    }
    if (line) lines.push(line)
    if (measure(tok.text, size) <= width) line = tok.text
    else {
      const pieces = breakWord(tok.text, size, width, measure)
      broke = true
      lines.push(...pieces.slice(0, -1))
      line = pieces[pieces.length - 1]
    }
  }
  if (line) lines.push(line)
  return { lines, broke }
}

/**
 * Fits a title horizontally into a spine's middle panel, like a printed spine
 * label: words wrap onto centered lines, as large as the panel allows. Breaking
 * a word with a hyphen is avoided unless needed at the minimum size; if the
 * lines still don't fit the panel's height, the last line ends with an ellipsis.
 */
export function fitTitle(title: string, width: number, height: number, measureRaw: Measure): FitResult {
  const measure = withSoftHyphen(measureRaw)
  const text = title.trim().replace(/\s+/g, ' ')
  const fits = (n: number, size: number) => n * size * LINE_HEIGHT <= height

  // 1. Largest size that fits without breaking words.
  for (let size = MAX_SIZE; size >= MIN_SIZE; size -= STEP) {
    const { lines, broke } = wrap(text, size, width, measure)
    if (!broke && fits(lines.length, size)) return { lines, size, truncated: false }
  }
  // 2. At the minimum size, allow hyphenated breaks; 3. then truncate.
  const size = MIN_SIZE
  const { lines } = wrap(text, size, width, measure)
  if (fits(lines.length, size)) return { lines, size, truncated: false }
  const max = Math.max(1, Math.floor(height / (size * LINE_HEIGHT)))
  const kept = lines.slice(0, max)
  kept[max - 1] = truncate(`${kept[max - 1].replace(/\u00AD$/, '')} ${lines.slice(max).join(' ')}`, size, width, measure)
  return { lines: kept, size, truncated: true }
}

/** Longest prefix (preferring a word boundary) that fits with an ellipsis. */
export function truncate(text: string, size: number, length: number, measure: Measure): string {
  const ell = '…'
  if (measure(text, size) <= length) return text
  let lo = 0, hi = text.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (measure(text.slice(0, mid).trimEnd() + ell, size) <= length) lo = mid
    else hi = mid - 1
  }
  let cut = text.slice(0, lo)
  const space = cut.lastIndexOf(' ')
  if (space > 0 && space >= lo * 0.6) cut = cut.slice(0, space)
  cut = cut.replace(/[\s,.;:–—-]+$/, '')
  return (cut || text.slice(0, Math.max(1, lo))) + ell
}

/** Canvas-based measurer using the spine title font (Instrument Serif 400). Results are cached. */
/** Wraps a measurer so a trailing soft hyphen is measured as a visible hyphen. */
export const withSoftHyphen = (m: Measure): Measure => (t, s) => m(t.endsWith(SOFT_HYPHEN) ? t.slice(0, -1) + '-' : t, s)

export function canvasMeasure(): Measure {
  const ctx = document.createElement('canvas').getContext('2d')
  const cache = new Map<string, number>()
  return (text, size) => {
    const key = `${size}|${text}`
    let w = cache.get(key)
    if (w === undefined) {
      if (!ctx) return text.length * size * 0.55
      ctx.font = `400 ${size}px "Instrument Serif", "Instrument Serif fallback", "Times New Roman", Georgia, serif`
      w = ctx.measureText(text).width
      cache.set(key, w)
    }
    return w
  }
}
