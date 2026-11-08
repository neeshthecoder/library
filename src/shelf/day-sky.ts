/**
 * The daytime counterpart to the night sky: a small smiling sun in the top
 * right and a few flat clouds drifting (statically) behind the headline and
 * subtitle. Flat fills and round-capped strokes, no gradients or shadows.
 * Each piece is its own absolutely positioned SVG so it keeps its shape at
 * any width; placement and size live in shelf.css.
 */

const RAYS: [number, number][] = [
  // [angle in degrees, length]
  [-100, 14], [-75, 18], [-50, 11], [-25, 16], [0, 10], [20, 17], [45, 12],
  [70, 16], [95, 11], [120, 17], [145, 12], [170, 16], [195, 10], [220, 15], [245, 12],
]

const ray = ([deg, len]: [number, number]) => {
  const a = (deg * Math.PI) / 180
  const r0 = 31
  const f = (r: number) => `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`
  return `M${f(r0)} L${f(r0 + len)}`
}

const SUN = `
<svg class="sky-sun" viewBox="-52 -52 104 104" focusable="false">
  <path d="${RAYS.map(ray).join(' ')}" fill="none" stroke="#f5d24b" stroke-width="4.5" stroke-linecap="round"/>
  <circle r="25" fill="#f5d24b"/>
  <path d="M-12,-5 C-11,-9 -5,-9 -4,-5 M4,-5 C5,-9 11,-9 12,-5 M-6,5 C-3,10 3,10 6,5" fill="none" stroke="#1d1f24" stroke-width="1.8" stroke-linecap="round"/>
  <ellipse cx="-13" cy="1" rx="3.6" ry="2.2" fill="#ee8e74" opacity="0.85"/>
  <ellipse cx="13" cy="1" rx="3.6" ry="2.2" fill="#ee8e74" opacity="0.85"/>
</svg>`

const CLOUD_PATH =
  'M18,56 C6,56 0,48 0,38 C0,26 10,18 22,19 C26,7 38,0 50,0 C62,0 70,6 74,14 ' +
  'C80,10 86,9 92,9 C104,9 112,16 116,26 C130,22 160,28 160,42 C160,51 152,56 142,56 Z'

const cloud = (n: number) =>
  `<svg class="sky-cloud sky-cloud-${n}" viewBox="0 0 160 56" focusable="false"><path d="${CLOUD_PATH}" fill="#e2e9ee"/></svg>`

export const DAY_SKY = SUN + [1, 2, 3, 4, 5].map(cloud).join('')
