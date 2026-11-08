export type Mode = 'spread' | 'single'

/** Pages shown together. Spread mode: page 1 alone on the right, then (2,3), (4,5)… */
export function spreadFor(page: number, total: number, mode: Mode): number[] {
  const p = Math.min(Math.max(1, page), Math.max(1, total))
  if (mode === 'single' || total <= 1) return [p]
  if (p === 1) return [1]
  const left = p % 2 === 0 ? p : p - 1
  return left + 1 <= total ? [left, left + 1] : [left]
}

export function nextPage(page: number, total: number, mode: Mode): number | null {
  const cur = spreadFor(page, total, mode)
  const n = cur[cur.length - 1] + 1
  return n <= total ? n : null
}

export function prevPage(page: number, total: number, mode: Mode): number | null {
  const cur = spreadFor(page, total, mode)
  const p = cur[0] - 1
  if (p < 1) return null
  return spreadFor(p, total, mode)[0]
}

export function pdfLabel(pages: number[], total: number): string {
  const a = pages[0], b = pages[pages.length - 1]
  return a === b ? `${a} of ${total}` : `${a}–${b} of ${total}`
}

export const SPREAD_QUERY = '(min-width: 48rem) and (orientation: landscape)'

export function currentMode(): Mode {
  return matchMedia(SPREAD_QUERY).matches ? 'spread' : 'single'
}
