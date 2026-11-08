import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { msUntilNextSwitch, themeAt } from '../../src/theme'

const at = (h: number, m = 0) => new Date(2026, 10, 8, h, m, 0, 0)

describe('day and night', () => {
  it('is day from 07:00 to 18:59 and night otherwise', () => {
    expect(themeAt(at(6, 59))).toBe('night')
    expect(themeAt(at(7, 0))).toBe('day')
    expect(themeAt(at(12))).toBe('day')
    expect(themeAt(at(18, 59))).toBe('day')
    expect(themeAt(at(19, 0))).toBe('night')
    expect(themeAt(at(0, 0))).toBe('night')
  })

  it('knows when the next switch is', () => {
    expect(msUntilNextSwitch(at(6, 30))).toBe(30 * 60_000)
    expect(msUntilNextSwitch(at(12))).toBe(7 * 3600_000)
    expect(msUntilNextSwitch(at(19))).toBe(12 * 3600_000)
    expect(msUntilNextSwitch(at(23, 15))).toBe((7 * 60 + 45) * 60_000)
  })

  it('the pre-paint script in public/theme.js agrees for every hour', () => {
    const src = readFileSync(fileURLToPath(new URL('../../public/theme.js', import.meta.url)), 'utf8')
    for (let h = 0; h < 24; h++) {
      const attrs: Record<string, string> = {}
      const fakeDate = class extends Date { constructor() { super(2026, 10, 8, h, 30) } }
      new Function('document', 'Date', src)({ documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } }, fakeDate)
      expect(attrs['data-theme'], `hour ${h}`).toBe(themeAt(at(h, 30)))
    }
  })
})
