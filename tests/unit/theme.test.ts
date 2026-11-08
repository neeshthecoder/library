import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { OVERRIDE_KEY, currentTheme, msUntilNextSwitch, themeAt, themeOverride } from '../../src/theme'

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

describe('manual override (the secret period toggle)', () => {
  const store: Record<string, string> = {}
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k]
    ;(globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => void (store[k] = String(v)),
      removeItem: (k: string) => void delete store[k],
      clear: () => {},
      key: () => null,
      length: 0,
    } as Storage
  })
  afterEach(() => { delete (globalThis as { localStorage?: Storage }).localStorage })

  it('has no override by default, so currentTheme follows the clock', () => {
    expect(themeOverride()).toBeNull()
    expect(currentTheme(() => at(1))).toBe('night')
    expect(currentTheme(() => at(12))).toBe('day')
  })

  it('wins over the clock at any hour and stays put (never follows a switch)', () => {
    store[OVERRIDE_KEY] = 'day'
    expect(themeOverride()).toBe('day')
    expect(currentTheme(() => at(1))).toBe('day') // 1 AM would be night
    expect(currentTheme(() => at(6, 59))).toBe('day') // just before the 07:00 switch
    expect(currentTheme(() => at(23))).toBe('day')
    store[OVERRIDE_KEY] = 'night'
    expect(currentTheme(() => at(12))).toBe('night') // noon would be day
  })

  it('ignores a junk stored value', () => {
    store[OVERRIDE_KEY] = 'teatime'
    expect(themeOverride()).toBeNull()
    expect(currentTheme(() => at(12))).toBe('day')
  })

  it('treats a throwing localStorage as no override', () => {
    ;(globalThis as { localStorage?: Storage }).localStorage = {
      getItem: () => { throw new Error('blocked') },
    } as unknown as Storage
    expect(themeOverride()).toBeNull()
  })
})
