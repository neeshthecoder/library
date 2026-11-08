/** A trim drawing in unit space: width is always 100, height is `H`. */
export interface TrimDrawing {
  /** SVG markup (inner elements only). */
  body: string
  /** Title box in unit space. */
  panel: { x: number; y: number; w: number; h: number }
}

export interface TrimOptions {
  /** Height in units (width is 100). */
  H: number
  /** Drop the finest lines on narrow spines. */
  lowDetail: boolean
}

export const W = 100
const f = (n: number) => +n.toFixed(2)

export const rect = (x: number, y: number, w: number, h: number, rx = 0, cls = 't-s') =>
  `<rect class="${cls}" x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"${rx ? ` rx="${f(rx)}"` : ''}/>`
export const line = (x1: number, y1: number, x2: number, y2: number) =>
  `<line class="t-s" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`

/** The flat spine body and the single flat tone band. */
export const bodyAndBand = (H: number) =>
  rect(1, 1, W - 2, H - 2, 6, 't-bg') + rect(34, 1, 32, H - 2, 0, 't-band')
