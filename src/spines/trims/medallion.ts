import { bodyAndBand, circle, path, rect, star, type TrimDrawing, type TrimOptions } from './common'

/**
 * Design B, "Medallion": a label plate, a star medallion, a tall arched panel,
 * an interlocking-circle lattice, and a leafy sprig at the foot.
 */
export const MEDALLION_HEAD = 84
export const MEDALLION_FOOT = 104

export function medallion({ H, lowDetail }: TrimOptions): TrimDrawing {
  const top = MEDALLION_HEAD
  const bot = H - MEDALLION_FOOT
  const latticeTop = H - 96

  const plate = rect(14, 9, 72, 22, 6) + (lowDetail ? '' : rect(19, 14, 62, 12, 3))
  const medal = circle(50, 56, 19) + (lowDetail ? '' : circle(50, 56, 15)) + star(50, 57, 10, 4.2)

  const arch = (x0: number, x1: number, t: number, b: number) =>
    `M${x0},${b} L${x0},${t + 20} A${(x1 - x0) / 2},20 0 0 1 ${x1},${t + 20} L${x1},${b}Z`
  const panel = path(arch(18, 82, top, bot)) + (lowDetail ? '' : path(arch(24, 76, top + 6, bot - 6)))

  const frameLines = rect(7, 40, 86, latticeTop - 46, 10)

  const lattice: string[] = [rect(14, latticeTop, 72, 46, 4)]
  const step = lowDetail ? 14 : 10
  const r = lowDetail ? 8 : 7
  for (let cy = latticeTop + 11; cy <= latticeTop + 36; cy += lowDetail ? 24 : 12) {
    for (let cx = 25; cx <= 75; cx += step) lattice.push(circle(cx, cy, r))
  }
  // keep the lattice inside its box
  const latticeClipped = `<svg x="14" y="${latticeTop}" width="72" height="46" viewBox="14 ${latticeTop} 72 46" overflow="hidden">${lattice.slice(1).join('')}</svg>${lattice[0]}`

  const s = H - 46
  const leaf = (dir: 1 | -1, y: number, len: number) =>
    path(`M50,${y} q${dir * len * 0.45},${-len * 0.55} ${dir * len},${-len * 0.25} q${-dir * len * 0.4},${len * 0.45} ${-dir * len},${len * 0.25}Z`, 't-f')
  const sprig = [
    path(`M50,${s} L50,${H - 10}`),
    leaf(-1, s + 14, 20), leaf(1, s + 14, 20),
    leaf(-1, s + 26, 26), leaf(1, s + 26, 26),
  ].join('')

  return {
    body: [bodyAndBand(H), frameLines, plate, medal, panel, latticeClipped, sprig].join(''),
    panel: { x: 28, y: top + 26, w: 44, h: bot - top - 36 },
  }
}
