import type { TrimDesign } from '../storage/manifest'

/** FNV-1a 32-bit hash → [0, 1). Stable across devices. */
export function hash01(id: string, salt = ''): number {
  let h = 0x811c9dc5
  const s = `${salt}:${id}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) / 4294967296
}

export const MIN_H = 0.74
export const MAX_H = 0.98
export const MIN_W = 0.12
export const MAX_W = 0.22
export const MIN_SPINE_PX = 44

/** Height as a fraction of shelf height, 0.74–0.98. */
export function spineHeight(id: string): number {
  return round(MIN_H + (MAX_H - MIN_H) * hash01(id, 'h'))
}

/**
 * Width as a fraction of shelf height. Grows with log(pages) between 50 and
 * 1000 pages, plus a small stable jitter. Frame trims bias wider since their
 * native proportions are broader.
 */
export function spineWidth(id: string, pages: number, design?: TrimDesign): number {
  const t = Math.min(1, Math.max(0, Math.log10(Math.max(1, pages) / 50) / Math.log10(20)))
  let w = 0.13 + 0.07 * t + (hash01(id, 'w') - 0.5) * 0.02
  if (design === 'frame') w += 0.02
  return round(Math.min(MAX_W, Math.max(MIN_W, w)))
}

/** Gap after a spine, in px: 0 or 4 for the hand-placed look. */
export function spineGap(id: string): number {
  return hash01(id, 'gap') < 0.5 ? 0 : 4
}

export function spinePx(h: number, w: number, shelfPx: number): { width: number; height: number } {
  return { width: Math.max(MIN_SPINE_PX, Math.round(w * shelfPx)), height: Math.round(h * shelfPx) }
}

const round = (x: number) => Math.round(x * 1000) / 1000
