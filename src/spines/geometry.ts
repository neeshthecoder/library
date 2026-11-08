/** FNV-1a 32-bit hash → [0, 1). Stable across devices. */
export function hash01(id: string, salt = ''): number {
  let h = 0x811c9dc5
  const s = `${salt}:${id}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  // murmur3 finalizer: spreads similar ids evenly
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

export const MIN_H = 0.74
export const MAX_H = 0.98
export const MIN_W = 0.12
export const MAX_W = 0.22
/** Narrowest a spine renders: wide enough for a horizontal title (and ≥ 44 px touch target). */
export const MIN_SPINE_PX = 60

/** Height as a fraction of shelf height, 0.74–0.98. */
export function spineHeight(id: string): number {
  return round(MIN_H + (MAX_H - MIN_H) * hash01(id, 'h'))
}

/**
 * Width as a fraction of shelf height. Grows with log(pages) between 50 and
 * 1000 pages, plus a small stable jitter.
 */
export function spineWidth(id: string, pages: number): number {
  const t = Math.min(1, Math.max(0, Math.log10(Math.max(1, pages) / 50) / Math.log10(20)))
  let w = 0.13 + 0.07 * t + (hash01(id, 'w') - 0.5) * 0.02
  return round(Math.min(MAX_W, Math.max(MIN_W, w)))
}

/** Gap after a spine, in px: 0 or 4 for the hand-placed look. */
export function spineGap(id: string): number {
  return hash01(id, 'gap') < 0.5 ? 0 : 4
}

/**
 * Lean angle in degrees: roughly one book in ten leans on its right-hand
 * neighbour, like a real shelf. Never the last book, never two in a row.
 */
export function spineLean(id: string, isLast: boolean, prevLeaned: boolean): number {
  if (isLast || prevLeaned) return 0
  const r = hash01(id, 'lean')
  return r < 0.1 ? Math.round((5 + r * 30) * 10) / 10 : 0
}

/**
 * Extra space a leaning book needs on its right. It tips on its bottom-right
 * corner, so its top moves right by h·sin(θ) and just touches the neighbour.
 */
export function leanGap(heightPx: number, _widthPx: number, deg: number): number {
  if (!deg) return 0
  return Math.ceil(heightPx * Math.sin((deg * Math.PI) / 180))
}

/**
 * On-screen thickness. Stored widths (0.12–0.22 of shelf height) are mapped
 * to chunkier books (0.19–0.32) so horizontal titles have room.
 */
export function displayWidth(w: number): number {
  return 0.19 + (w - MIN_W) * 1.3
}

export function spinePx(h: number, w: number, shelfPx: number): { width: number; height: number } {
  return { width: Math.max(MIN_SPINE_PX, Math.round(displayWidth(w) * shelfPx)), height: Math.round(h * shelfPx) }
}

const round = (x: number) => Math.round(x * 1000) / 1000
