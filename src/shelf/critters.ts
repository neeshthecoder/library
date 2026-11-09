/**
 * Small shelf-dwellers: a squirrel, two birds, acorns, and a worm. Flat,
 * minimal illustration (like the spines and the bookend): solid fills, a few
 * round-capped detail lines, no gradients or shadows. They're static and keep
 * the same colors day and night.
 *
 * They stand on the bookcase's top board, one over every few books, so the
 * shelf picks up another as it grows. Each SVG's viewBox bottom edge is the board.
 */

export type CritterKind = 'squirrel' | 'titmouse' | 'sparrow' | 'acorns' | 'acorn' | 'worm'

interface Critter {
  /** viewBox width and height */
  w: number
  h: number
  /** rendered height as a fraction of the shelf height */
  scale: number
  svg: string
}

const LINE = 'fill="none" stroke-linecap="round" stroke-linejoin="round"'

const acornShape = (x: number, y: number, rot: number) => `
  <g transform="translate(${x} ${y}) rotate(${rot})">
    <path d="M-13,-2 C-14,10 -8,20 0,24 C8,20 14,10 13,-2 Z" fill="#c4a56c"/>
    <path d="M-8,2 C-9,9 -6,14 -3,17" stroke="#8a6d3e" stroke-width="2" ${LINE}/>
    <path d="M-16,0 C-16,-10 -8,-15 0,-15 C8,-15 16,-10 16,0 C16,3 14,4 12,4 L-12,4 C-14,4 -16,3 -16,0 Z" fill="#7b5532"/>
    <path d="M0,-14 C0,-19 3,-22 7,-22" stroke="#7b5532" stroke-width="3.5" ${LINE}/>
  </g>`

const CRITTERS: Record<CritterKind, Critter> = {
  // sitting, facing left, eyes closed, a curl in its tail
  squirrel: {
    w: 120, h: 100, scale: 0.34,
    svg: `
      <path d="M74,96 C100,98 118,82 114,60 C111,44 99,40 92,48 C102,28 102,6 86,4 C70,2 60,20 63,42 C65,60 60,82 74,96 Z" fill="#b57c45"/>
      <path d="M86,22 C78,30 94,36 96,46 C98,56 86,58 88,66 C90,74 102,72 100,82" stroke="#5a2a28" stroke-width="2.4" ${LINE}/>
      <ellipse cx="58" cy="74" rx="25" ry="25" fill="#b57c45"/>
      <path d="M36,62 C32,74 34,90 42,98 L58,98 C50,88 48,72 50,60 Z" fill="#f2d2b6"/>
      <path d="M58,58 C72,56 82,70 80,86" stroke="#5a2a28" stroke-width="2.2" ${LINE}/>
      <path d="M40,100 C40,94 46,92 54,92 L74,92 C80,92 82,100 76,100 Z" fill="#b57c45"/>
      <path d="M48,96 L56,94" stroke="#5a2a28" stroke-width="2" ${LINE}/>
      <path d="M34,64 C30,70 30,78 33,82" stroke="#b57c45" stroke-width="7" ${LINE}/>
      <path d="M26,32 L28,18 C32,18 36,24 36,30 Z" fill="#b57c45"/>
      <path d="M28,29 L29,22 C31,23 33,26 33,29 Z" fill="#5a2a28"/>
      <path d="M36,30 L40,16 C44,17 46,24 45,31 Z" fill="#b57c45"/>
      <path d="M38.5,29 L41,21 C43,22 44,26 43.5,30 Z" fill="#5a2a28"/>
      <path d="M50,40 C50,30 42,26 34,27 C24,28 18,36 14,46 C12,50 16,54 22,55 C34,58 50,52 50,40 Z" fill="#b57c45"/>
      <circle cx="14.5" cy="47" r="2.6" fill="#5a2a28"/>
      <path d="M27,40 C29,42 32,42 34,40" stroke="#5a2a28" stroke-width="1.8" ${LINE}/>
      <path d="M26,48 C29,51 33,50 35,47" stroke="#5a2a28" stroke-width="1.8" ${LINE}/>`,
  },
  // dusty blue, crested, facing left
  titmouse: {
    w: 100, h: 90, scale: 0.2,
    svg: `
      <path d="M58,62 L86,82 C90,85 86,90 82,88 L52,72 Z" fill="#86b0bb"/>
      <path d="M34,10 L38,2 C40,8 46,12 52,18 C66,32 76,48 74,62 C72,74 58,78 42,78 C24,78 14,68 14,52 C14,38 18,24 26,16 C29,13 32,12 34,10 Z" fill="#86b0bb"/>
      <path d="M44,40 C56,34 68,44 74,60 C70,68 60,70 50,68 C40,66 36,48 44,40 Z" fill="#b6ccd3"/>
      <path d="M16,34 L4,32 L15,40 Z" fill="#86b0bb"/>
      <ellipse cx="26" cy="30" rx="2" ry="3.4" fill="#1d1f24"/>
      <path d="M34,76 L28,88 M28,88 L23,86 M28,88 L25,90 M44,76 L42,88 M42,88 L38,90 M42,88 L44,90" stroke="#1d1f24" stroke-width="2.2" ${LINE}/>`,
  },
  // round grey sparrow with a dark wing, facing right
  sparrow: {
    w: 100, h: 86, scale: 0.19,
    svg: `
      <path d="M40,56 L6,70 C2,72 4,76 8,76 L44,72 Z" fill="#a3a5ab"/>
      <path d="M30,52 C30,28 46,14 64,14 C80,14 90,26 90,42 C90,60 78,72 60,72 C42,72 30,66 30,52 Z" fill="#a3a5ab"/>
      <path d="M22,62 C30,46 46,38 62,40 C66,52 58,64 44,66 C36,67 28,66 22,62 Z" fill="#1d2234"/>
      <path d="M88,34 L100,40 L88,46 Z" fill="#1d2234"/>
      <circle cx="74" cy="32" r="4.2" fill="#1d2234"/>
      <path d="M52,72 L52,82 M62,72 L64,82" stroke="#1d2234" stroke-width="4.5" ${LINE}/>
      <rect x="44" y="81" width="30" height="5" rx="2.5" fill="#1d2234"/>`,
  },
  acorns: {
    w: 80, h: 44, scale: 0.11,
    svg: acornShape(20, 20, -14) + acornShape(58, 26, 62),
  },
  acorn: {
    w: 36, h: 46, scale: 0.1,
    svg: acornShape(18, 22, 8),
  },
  // an inchworm, mid-step, facing right
  worm: {
    w: 90, h: 40, scale: 0.1,
    svg: `
      <path d="M8,38 C14,38 18,34 22,26 C28,10 46,8 52,22 C56,32 60,38 70,38" stroke="#e39a96" stroke-width="10" ${LINE}/>
      <circle cx="74" cy="34" r="8" fill="#e39a96"/>
      <circle cx="76" cy="32" r="1.6" fill="#3a1e1e"/>
      <path d="M78,37 C79,38 81,38 82,37" stroke="#3a1e1e" stroke-width="1.3" ${LINE}/>`,
  },
}

const ORDER: CritterKind[] = ['squirrel', 'acorns', 'titmouse', 'worm', 'sparrow', 'acorn']
/** One critter every this many books. */
export const BOOKS_PER_CRITTER = 6
/** The first critter comes after this many books. */
const FIRST_AFTER = 3

/**
 * Which critter (if any) stands over the `n`th book on the shelf (1-based).
 * After book 3 comes the first; then one every six books, cycling through
 * the cast, so adding books only ever appends new critters.
 */
export function critterAfter(n: number): CritterKind | null {
  if (n < FIRST_AFTER || (n - FIRST_AFTER) % BOOKS_PER_CRITTER) return null
  return ORDER[((n - FIRST_AFTER) / BOOKS_PER_CRITTER) % ORDER.length]
}

/**
 * What a critter does when it's a control rather than decoration:
 * - `theme-toggle`: the first squirrel, a `role="switch"` holding a "Click Me!" sign.
 * - `leaderboard`: the first acorn pair, an unlabeled-looking button that opens
 *   the reading leaderboard check-in.
 */
export type CritterRole = 'theme-toggle' | 'leaderboard'

/**
 * An element holding the critter, sized to the shelf. A plain decorative
 * `<div>` unless a `role` is given, in which case it's a button.
 */
export function critterItem(kind: CritterKind, shelfPx: number, role?: CritterRole): HTMLElement {
  const c = CRITTERS[kind]
  const h = Math.max(14, Math.round(c.scale * shelfPx))
  const w = Math.round((h * c.w) / c.h)
  const art = `<svg class="critter-art" viewBox="0 0 ${c.w} ${c.h}" width="${w}" height="${h}" focusable="false" aria-hidden="true">${c.svg}</svg>`
  if (role) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.dataset.critter = kind
    if (role === 'theme-toggle') {
      btn.className = 'critter critter-button critter-toggle'
      btn.setAttribute('role', 'switch')
      btn.setAttribute('aria-checked', 'false')
      btn.setAttribute('aria-label', 'Night mode')
      btn.innerHTML = `<span class="critter-sign">Click Me!</span>${art}`
    } else {
      btn.className = 'critter critter-button critter-leaderboard'
      btn.setAttribute('aria-label', 'Acorns')
      btn.innerHTML = art
    }
    return btn
  }
  const el = document.createElement('div')
  el.className = 'critter'
  el.dataset.critter = kind
  el.setAttribute('aria-hidden', 'true')
  el.innerHTML = art
  return el
}
