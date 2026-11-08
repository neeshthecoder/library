import { bodyAndBand, flipY, path, sparkle, type TrimDrawing, type TrimOptions } from './common'

/**
 * Design C, "Arch": semicircular caps with a split-leaf fleuron, an ogee
 * arched panel, and four four-point sparkles.
 */
export const ARCH_CAP = 94

function ogee(x0: number, x1: number, t: number, b: number): string {
  const c = (x0 + x1) / 2
  const w = x1 - x0
  return (
    `M${x0},${t + 34} C${x0},${t + 20} ${c - w * 0.18},${t + 16} ${c - 4},${t + 8} L${c},${t} L${c + 4},${t + 8} ` +
    `C${c + w * 0.18},${t + 16} ${x1},${t + 20} ${x1},${t + 34} L${x1},${b - 34} ` +
    `C${x1},${b - 20} ${c + w * 0.18},${b - 16} ${c + 4},${b - 8} L${c},${b} L${c - 4},${b - 8} ` +
    `C${c - w * 0.18},${b - 16} ${x0},${b - 20} ${x0},${b - 34}Z`
  )
}

function cap(lowDetail: boolean): string {
  const leafL = 'M48,24 C36,22 28,32 33,42 C37,37 42,38 40,46 C46,46 48,40 48,33Z'
  const leafR = 'M52,24 C64,22 72,32 67,42 C63,37 58,38 60,46 C54,46 52,40 52,33Z'
  return [
    path('M10,8 L90,8 L90,30 A40,40 0 0 1 10,30Z'),
    lowDetail ? '' : path('M16,14 L84,14 L84,30 A34,34 0 0 1 16,30Z'),
    path(leafL, 't-f'),
    path(leafR, 't-f'),
    path('M50,20 L50,58'),
  ].join('')
}

export function arch({ H, lowDetail }: TrimOptions): TrimDrawing {
  const top = ARCH_CAP
  const bot = H - ARCH_CAP
  const c = cap(lowDetail)
  const body = [
    bodyAndBand(H),
    c,
    flipY(c, H),
    path(ogee(22, 78, top, bot)),
    lowDetail ? '' : path(ogee(27, 73, top + 7, bot - 7)),
    sparkle(13, top - 6, 7),
    sparkle(87, top - 6, 7),
    sparkle(13, bot + 6, 7),
    sparkle(87, bot + 6, 7),
  ].join('')
  return { body, panel: { x: 30, y: top + 40, w: 40, h: bot - top - 80 } }
}
