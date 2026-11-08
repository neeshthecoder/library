import { hexToOklch, hexToRgb, oklchToHex, toLinear } from './color'

/** The two fallback title inks: styleguide paper and ink. */
export const LIGHT_INK = '#F8F6F1'
export const DARK_INK = '#232C32'
export const PAGE_BG = '#F8F6F1'

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Title ink: the trim color if it reaches 4.5:1, else the better of paper/ink,
 * else pure white/black. max(contrast vs white, vs black) ≥ 4.58 for any
 * color, so the result always reaches 4.5:1.
 */
export function pickTitleInk(bg: string, trim: string): string {
  if (contrast(bg, trim) >= 4.5) return trim
  const soft = contrast(bg, LIGHT_INK) >= contrast(bg, DARK_INK) ? LIGHT_INK : DARK_INK
  if (contrast(bg, soft) >= 4.5) return soft
  return contrast(bg, '#FFFFFF') >= contrast(bg, '#000000') ? '#FFFFFF' : '#000000'
}

/**
 * Adjusts a color's lightness (keeping hue) until it reaches `min` contrast
 * against `against`. Used for the bookmark ribbon on the paper background.
 */
export function ensureContrast(color: string, against: string, min: number): string {
  if (contrast(color, against) >= min) return color
  const [L, C, H] = hexToOklch(color)
  const darker = luminance(against) > 0.18
  let lo = darker ? 0 : L, hi = darker ? L : 1
  let best = darker ? oklchToHex([0, C, H]) : oklchToHex([1, C, H])
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    const hex = oklchToHex([mid, C, H])
    if (contrast(hex, against) >= min) {
      best = hex
      if (darker) lo = mid
      else hi = mid
    } else if (darker) hi = mid
    else lo = mid
  }
  return best
}
