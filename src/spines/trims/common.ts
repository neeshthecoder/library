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
export const circle = (cx: number, cy: number, r: number, cls = 't-s') =>
  `<circle class="${cls}" cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"/>`
export const line = (x1: number, y1: number, x2: number, y2: number) =>
  `<line class="t-s" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`
export const path = (d: string, cls = 't-s') => `<path class="${cls}" d="${d.replace(/-?\d+\.\d{3,}/g, (m) => String(f(+m)))}"/>`

/** The flat spine body and the single flat tone band. */
export const bodyAndBand = (H: number) =>
  rect(1, 1, W - 2, H - 2, 6, 't-bg') + rect(34, 1, 32, H - 2, 0, 't-band')

/** Concave four-point sparkle. */
export function sparkle(cx: number, cy: number, r: number): string {
  const k = r * 0.18
  return path(
    `M${cx},${cy - r} Q${cx + k},${cy - k} ${cx + r},${cy} Q${cx + k},${cy + k} ${cx},${cy + r} ` +
      `Q${cx - k},${cy + k} ${cx - r},${cy} Q${cx - k},${cy - k} ${cx},${cy - r}Z`,
    't-f',
  )
}

/** Filled five-point star. */
export function star(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    pts.push(`${f(cx + r * Math.cos(a))},${f(cy + r * Math.sin(a))}`)
  }
  return `<polygon class="t-f" points="${pts.join(' ')}"/>`
}

/** Diamond (rhombus), filled. */
export const diamond = (cx: number, cy: number, w: number, h: number) =>
  path(`M${cx},${cy - h / 2} L${cx + w / 2},${cy} L${cx},${cy + h / 2} L${cx - w / 2},${cy}Z`, 't-f')

/** Mirror a drawing vertically around the spine's middle. */
export const flipY = (markup: string, H: number) => `<g transform="matrix(1 0 0 -1 0 ${f(H)})">${markup}</g>`
