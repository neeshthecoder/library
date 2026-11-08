import { bodyAndBand, line, rect, W, type TrimDrawing, type TrimOptions } from './common'

/**
 * Cover-derived spine: the cover's dominant color as a flat background with two
 * accent bands and thin rules near each end. No attempt at real spine art.
 */
export function coverSpine({ H }: TrimOptions): TrimDrawing {
  const band = Math.max(14, H * 0.05)
  const inset = Math.max(16, H * 0.06)
  const body = [
    bodyAndBand(H),
    rect(1, inset, W - 2, band, 0, 't-f'),
    rect(1, H - inset - band, W - 2, band, 0, 't-f'),
    line(10, inset + band + 8, 90, inset + band + 8),
    line(10, H - inset - band - 8, 90, H - inset - band - 8),
  ].join('')
  const y = inset + band + 18
  return { body, panel: { x: 16, y, w: 68, h: H - 2 * y } }
}
