/** Measures the advance width of `text` at `size` px. */
export type Measure = (text: string, size: number) => number

export interface FitResult {
  lines: string[]
  size: number
  truncated: boolean
}

export const MAX_SIZE = 20
export const MIN_SIZE = 11
export const LINE_HEIGHT = 1.15
const STEP = 0.5

/**
 * Fits a title into a vertical panel. `thickness` is the panel's width (the
 * direction lines stack in) and `length` is its height (the direction text
 * runs in). Tries one line, then two balanced lines, then truncates with an
 * ellipsis at the minimum size.
 */
export function fitTitle(title: string, thickness: number, length: number, measure: Measure): FitResult {
  const text = title.trim().replace(/\s+/g, ' ')
  const start = Math.min(MAX_SIZE, Math.floor((thickness * 0.62) / STEP) * STEP)
  const twoLinesPossible = 2 * MIN_SIZE * LINE_HEIGHT <= thickness

  for (let size = start; size >= MIN_SIZE; size -= STEP) {
    if (size * LINE_HEIGHT <= thickness && measure(text, size) <= length) {
      return { lines: [text], size, truncated: false }
    }
  }

  if (twoLinesPossible) {
    const words = text.split(' ')
    if (words.length > 1) {
      const maxTwo = Math.min(start, Math.floor(thickness / (2 * LINE_HEIGHT) / STEP) * STEP)
      for (let size = maxTwo; size >= MIN_SIZE; size -= STEP) {
        const split = bestSplit(words, size, measure)
        if (split && Math.max(measure(split[0], size), measure(split[1], size)) <= length) {
          return { lines: split, size, truncated: false }
        }
      }
    }
  }

  const size = Math.max(MIN_SIZE, Math.min(start, MIN_SIZE))
  return { lines: [truncate(text, size, length, measure)], size, truncated: true }
}

function bestSplit(words: string[], size: number, measure: Measure): [string, string] | null {
  let best: [string, string] | null = null
  let bestMax = Infinity
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ')
    const b = words.slice(i).join(' ')
    const m = Math.max(measure(a, size), measure(b, size))
    if (m < bestMax) {
      bestMax = m
      best = [a, b]
    }
  }
  return best
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

/** Canvas-based measurer using the spine title font (Helvetica 500). Results are cached. */
export function canvasMeasure(): Measure {
  const ctx = document.createElement('canvas').getContext('2d')
  const cache = new Map<string, number>()
  return (text, size) => {
    const key = `${size}|${text}`
    let w = cache.get(key)
    if (w === undefined) {
      if (!ctx) return text.length * size * 0.55
      ctx.font = `500 ${size}px Helvetica, "Helvetica Neue", Arial, sans-serif`
      w = ctx.measureText(text).width
      cache.set(key, w)
    }
    return w
  }
}
