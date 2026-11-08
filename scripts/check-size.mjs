// Fails the build if the JavaScript needed to render the shelf exceeds the
// budget. Walks the Vite manifest from index.html through static imports only;
// dynamic imports (pdf.js, foliate-js, the reader) are excluded by design.
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const LIMIT = Number(process.env.SHELF_JS_LIMIT_KB ?? 150) * 1024
const dist = new URL('../dist/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('.vite/manifest.json', dist), 'utf8'))

const seen = new Set()
const visit = (key) => {
  if (seen.has(key)) return
  seen.add(key)
  for (const dep of manifest[key].imports ?? []) visit(dep)
}
visit('index.html')

let total = 0
for (const key of seen) {
  const file = manifest[key].file
  if (!file.endsWith('.js')) continue
  const size = gzipSync(readFileSync(new URL(file, dist))).length
  total += size
  console.log(`${(size / 1024).toFixed(1).padStart(7)} KB  ${file}`)
}
const kb = (total / 1024).toFixed(1)
if (total >= LIMIT) {
  console.error(`Shelf JavaScript is ${kb} KB gzipped, over the ${LIMIT / 1024} KB budget.`)
  process.exit(1)
}
console.log(`Shelf JavaScript: ${kb} KB gzipped (budget ${LIMIT / 1024} KB).`)
