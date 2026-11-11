// Copies the Latin-subset WOFF2 files from Fontsource into public/fonts.
// Run with `npm run fonts` after upgrading the font packages.
//
// TeX Gyre Pagella (the spine's Palatino stand-in) isn't on Fontsource, so
// public/fonts/tex-gyre-pagella-latin-400.woff2 is committed by hand, with its
// GUST Font License next to it. It was built from
//   https://mirrors.ctan.org/fonts/tex-gyre/opentype/texgyrepagella-regular.otf
// with fontTools:
//   pyftsubset texgyrepagella-regular.otf --flavor=woff2 --layout-features=kern,liga \
//     --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" \
//     --output-file=tex-gyre-pagella-latin-400.woff2
import { copyFileSync, mkdirSync } from 'node:fs'

const out = new URL('../public/fonts/', import.meta.url)
mkdirSync(out, { recursive: true })
const files = [
  ['@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2', 'instrument-serif-latin-400.woff2'],
  ['@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff2', 'eb-garamond-latin-400.woff2'],
  ['@fontsource/cardo/files/cardo-latin-400-normal.woff2', 'cardo-latin-400.woff2'],
  ['@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff2', 'cormorant-garamond-latin-500.woff2'],
  ['@fontsource/crimson-pro/files/crimson-pro-latin-400-normal.woff2', 'crimson-pro-latin-400.woff2'],
]
for (const [from, to] of files) {
  copyFileSync(new URL(`../node_modules/${from}`, import.meta.url), new URL(to, out))
  console.log(`public/fonts/${to}`)
}
