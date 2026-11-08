import { describe, expect, it } from 'vitest'
import { formatSize, libraryReadout, MB } from '../../src/ui/format'

describe('size readout', () => {
  it('formats sizes', () => {
    expect(formatSize(184 * MB)).toBe('184 MB')
    expect(formatSize(1.2 * 1024 * MB)).toBe('1.2 GB')
    expect(formatSize(640 * 1024)).toBe('640 KB')
    expect(formatSize(140 * MB)).toBe('140 MB')
  })

  it('reads "N books · X of about 1 GB"', () => {
    expect(libraryReadout(12, 184 * MB)).toEqual({ text: '12 books · 184 MB of about 1 GB', nearLimit: false })
    expect(libraryReadout(1, 2 * MB).text).toBe('1 book · 2 MB of about 1 GB')
  })

  it('warns over 800 MB', () => {
    const r = libraryReadout(40, 801 * MB)
    expect(r.nearLimit).toBe(true)
    expect(r.text).toMatch(/close to its storage limit/)
    expect(libraryReadout(40, 800 * MB).nearLimit).toBe(false)
  })
})
