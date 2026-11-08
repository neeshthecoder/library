import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { TOKENS } from '../../src/styles/tokens'

const root = fileURLToPath(new URL('../..', import.meta.url))
const read = (p: string) => readFileSync(join(root, p), 'utf8')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

describe('design tokens', () => {
  const css = read('src/styles/tokens.css')
  const guide = read('STYLEGUIDE.md')

  it('declares every color token from the styleguide with the same value', () => {
    const rows = [...guide.matchAll(/\|\s*`(--[a-z-]+)`\s*\|\s*`(#[0-9A-Fa-f]{6})`/g)]
    expect(rows.length).toBeGreaterThanOrEqual(11)
    for (const [, name, hex] of rows) {
      expect(css, name).toMatch(new RegExp(`${name}:\\s*${hex}`, 'i'))
    }
  })

  it('declares the radius tokens and the single shadow', () => {
    expect(css).toMatch(/--radius-card:\s*2rem/)
    expect(css).toMatch(/--radius-input:\s*1rem/)
    expect(css).toMatch(/--radius-pill:\s*999px/)
    expect(css).toMatch(/--shadow:\s*0 2px 8px rgba\(35, 44, 50, 0\.12\)/)
  })

  it('keeps tokens.ts in sync with tokens.css', () => {
    const map: Record<string, string> = { paper: '--paper', linen: '--linen', ink: '--ink', inkMuted: '--ink-muted', navy: '--navy', onDark: '--on-dark' }
    for (const [k, v] of Object.entries(TOKENS)) {
      expect(css).toMatch(new RegExp(`${map[k]}:\\s*${v}`, 'i'))
    }
  })

  it('uses no raw hex colors outside tokens and spine illustrations', () => {
    const allowed = [/^src\/styles\/tokens\.(css|ts)$/, /^src\/spines\//, /^src\/types\//]
    const offenders: string[] = []
    for (const file of walk(join(root, 'src'))) {
      const rel = relative(root, file).replaceAll('\\', '/')
      if (allowed.some((re) => re.test(rel))) continue
      const text = readFileSync(file, 'utf8')
      const hits = text.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![\w-])/g)?.filter((h) => !/^#\d{3}$/.test(h) || /[a-f]/i.test(h))
      if (hits?.length) offenders.push(`${rel}: ${hits.join(', ')}`)
    }
    expect(offenders).toEqual([])
  })
})
