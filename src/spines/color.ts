// Color helpers: sRGB hex <-> linear <-> OKLab / OKLCH.
export type RGB = [number, number, number] // 0..1 gamma-encoded sRGB
export type Lab = [number, number, number]
export type LCH = [number, number, number] // L 0..1, C, H degrees

export function hexToRgb(hex: string): RGB {
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(`Invalid color: ${hex}`)
  const n = parseInt(h, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export function rgbToHex([r, g, b]: RGB): string {
  const c = (x: number) => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

export const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
export const fromLinear = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

export function rgbToOklab([r, g, b]: RGB): Lab {
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/** Returns linear-light RGB (may be out of 0..1 if out of gamut). */
export function oklabToLinear([L, a, b]: Lab): RGB {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

export const lchToLab = ([L, C, H]: LCH): Lab => [L, C * Math.cos((H * Math.PI) / 180), C * Math.sin((H * Math.PI) / 180)]
export function labToLch([L, a, b]: Lab): LCH {
  const H = (Math.atan2(b, a) * 180) / Math.PI
  return [L, Math.hypot(a, b), H < 0 ? H + 360 : H]
}

const inGamut = (lin: RGB) => lin.every((c) => c >= -1e-4 && c <= 1 + 1e-4)

/** Converts OKLCH to hex, reducing chroma until it fits in sRGB. */
export function oklchToHex(lch: LCH): string {
  let [L, C, H] = lch
  L = Math.min(1, Math.max(0, L))
  let lin = oklabToLinear(lchToLab([L, C, H]))
  if (!inGamut(lin)) {
    let lo = 0, hi = C
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2
      if (inGamut(oklabToLinear(lchToLab([L, mid, H])))) lo = mid
      else hi = mid
    }
    C = lo
    lin = oklabToLinear(lchToLab([L, C, H]))
  }
  return rgbToHex(lin.map((c) => fromLinear(Math.min(1, Math.max(0, c)))) as RGB)
}

export const hexToOklch = (hex: string): LCH => labToLch(rgbToOklab(hexToRgb(hex)))
