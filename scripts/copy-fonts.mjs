// Copies the Latin-subset WOFF2 files from Fontsource into public/fonts.
// Run with `npm run fonts` after upgrading the font packages.
import { copyFileSync, mkdirSync } from 'node:fs'

const out = new URL('../public/fonts/', import.meta.url)
mkdirSync(out, { recursive: true })
const files = [
  ['@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2', 'instrument-serif-latin-400.woff2'],
]
for (const [from, to] of files) {
  copyFileSync(new URL(`../node_modules/${from}`, import.meta.url), new URL(to, out))
  console.log(`public/fonts/${to}`)
}
