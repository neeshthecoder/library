import { hexToOklch, oklchToHex, rgbToHex, rgbToOklab, oklabToLinear, fromLinear, type Lab, type RGB } from './color'
import { contrast } from './contrast'
import { mulberry32 } from './palette'

export const SAMPLE_W = 48
export const SAMPLE_H = 72

export interface CoverColors {
  dominant: string
  accent: string
}

interface Cluster {
  center: Lab
  size: number
}

/** Deterministic k-means in OKLab. */
export function kmeans(points: Lab[], k: number, iterations = 12, seed = 7): Cluster[] {
  if (!points.length) return []
  const rng = mulberry32(seed)
  // k-means++ style seeding
  const centers: Lab[] = [points[Math.floor(rng() * points.length)]]
  while (centers.length < Math.min(k, points.length)) {
    const d = points.map((p) => Math.min(...centers.map((c) => dist2(p, c))))
    const sum = d.reduce((a, b) => a + b, 0)
    if (sum === 0) break
    let r = rng() * sum
    let i = 0
    while (r > d[i] && i < d.length - 1) r -= d[i++]
    centers.push(points[i])
  }
  const assign = new Int32Array(points.length)
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < points.length; i++) {
      let best = 0, bd = Infinity
      for (let c = 0; c < centers.length; c++) {
        const dd = dist2(points[i], centers[c])
        if (dd < bd) { bd = dd; best = c }
      }
      assign[i] = best
    }
    const sums = centers.map(() => [0, 0, 0, 0])
    for (let i = 0; i < points.length; i++) {
      const s = sums[assign[i]]
      s[0] += points[i][0]; s[1] += points[i][1]; s[2] += points[i][2]; s[3]++
    }
    sums.forEach((s, c) => { if (s[3]) centers[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]] })
  }
  const sizes = new Array(centers.length).fill(0)
  for (let i = 0; i < points.length; i++) sizes[assign[i]]++
  return centers.map((center, i) => ({ center, size: sizes[i] })).filter((c) => c.size > 0).sort((a, b) => b.size - a.size)
}

const dist2 = (a: Lab, b: Lab) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
const labHex = (l: Lab) => rgbToHex(oklabToLinear(l).map((c) => fromLinear(Math.min(1, Math.max(0, c)))) as RGB)

/**
 * Picks dominant + accent from RGBA pixels. Ignores near-transparent pixels
 * and a 4% border. Accent: the cluster with ≥ 3:1 contrast against the
 * dominant that maximizes chroma distance × log(size); otherwise synthesized.
 */
export function colorsFromPixels(data: Uint8ClampedArray, w: number, h: number): CoverColors {
  const bx = Math.round(w * 0.04), by = Math.round(h * 0.04)
  const pts: Lab[] = []
  for (let y = by; y < h - by; y++) {
    for (let x = bx; x < w - bx; x++) {
      const i = (y * w + x) * 4
      if (data[i + 3] < 128) continue
      pts.push(rgbToOklab([data[i] / 255, data[i + 1] / 255, data[i + 2] / 255]))
    }
  }
  if (!pts.length) return { dominant: '#3b4a54', accent: '#e8d9b8' }
  const clusters = kmeans(pts, 5)
  const dominant = labHex(clusters[0].center)
  let best: string | null = null
  let score = -Infinity
  for (const c of clusters.slice(1)) {
    const hex = labHex(c.center)
    if (contrast(dominant, hex) < 3) continue
    const d = Math.hypot(c.center[1] - clusters[0].center[1], c.center[2] - clusters[0].center[2]) + Math.abs(c.center[0] - clusters[0].center[0]) * 0.5
    const s = d * Math.log(1 + c.size)
    if (s > score) { score = s; best = hex }
  }
  return { dominant, accent: best ?? synthesizeAccent(dominant) }
}

/** Rotates the hue 180° and moves lightness until it reaches 3:1. */
export function synthesizeAccent(dominant: string): string {
  const [L, C, H] = hexToOklch(dominant)
  const hue = (H + 180) % 360
  const chroma = Math.max(0.08, C)
  const lighter = L < 0.6
  for (let step = 1; step <= 40; step++) {
    const l = lighter ? Math.min(1, L + step * 0.025) : Math.max(0, L - step * 0.025)
    const hex = oklchToHex([l, chroma, hue])
    if (contrast(dominant, hex) >= 3) return hex
  }
  return lighter ? '#f8f6f1' : '#232c32'
}

/** Downsamples an image (Blob) and extracts colors. Browser only. */
export async function coverColors(cover: Blob): Promise<CoverColors> {
  const bmp = await createImageBitmap(cover, { resizeWidth: SAMPLE_W, resizeHeight: SAMPLE_H, resizeQuality: 'medium' })
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(SAMPLE_W, SAMPLE_H) : Object.assign(document.createElement('canvas'), { width: SAMPLE_W, height: SAMPLE_H })
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  ctx.drawImage(bmp, 0, 0, SAMPLE_W, SAMPLE_H)
  bmp.close()
  const { data } = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H)
  return colorsFromPixels(data, SAMPLE_W, SAMPLE_H)
}
