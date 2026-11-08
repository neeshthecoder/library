import { bodyAndBand, circle, diamond, flipY, line, path, rect, W, type TrimDrawing, type TrimOptions } from './common'

/**
 * Design A, "Frame": nested rectilinear frames, half-pill side tabs, corner
 * notches, and a tall panel with a bump at each end holding a diamond and two
 * dots.
 */
export const FRAME_CAP = 64

export function frame({ H, lowDetail }: TrimOptions): TrimDrawing {
  const top = FRAME_CAP
  const bot = H - FRAME_CAP
  const x0 = 26, x1 = 74

  const head = [
    line(12, 26, 88, 26),
    lowDetail ? '' : rect(16, 16, 6, 6) + rect(78, 16, 6, 6),
    diamond(50, top + 12, 9, 14),
    circle(37, top + 14, 3.2),
    circle(63, top + 14, 3.2),
  ].join('')

  const panel = path(
    `M${x0},${top + 10} Q${x0},${top} ${x0 + 10},${top} L41,${top} A9,9 0 0 1 59,${top} L${x1 - 10},${top} Q${x1},${top} ${x1},${top + 10} ` +
      `L${x1},${bot - 10} Q${x1},${bot} ${x1 - 10},${bot} L59,${bot} A9,9 0 0 1 41,${bot} L${x0 + 10},${bot} Q${x0},${bot} ${x0},${bot - 10}Z`,
  )

  const tab = (y: number) =>
    rect(3, y - 8, 21, 16, 8, 't-tab') + rect(76, y - 8, 21, 16, 8, 't-tab')

  const body = [
    bodyAndBand(H),
    rect(6, 6, 88, H - 12, 2),
    lowDetail ? '' : rect(12, 12, 76, H - 24),
    head,
    flipY(head, H),
    panel,
    tab(H * 0.3),
    tab(H * 0.7),
  ].join('')

  return { body, panel: { x: x0 + 4, y: top + 28, w: x1 - x0 - 8, h: bot - top - 56 } }
}

export { W }
