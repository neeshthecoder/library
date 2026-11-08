import { describe, expect, it } from 'vitest'
import { MSG } from '../../src/import/messages'
import { sizeError } from '../../src/import/queue'
import { MB } from '../../src/ui/format'

describe('size checks', () => {
  it('rejects files over 100 MB with the exact message', () => {
    expect(sizeError(140 * MB, 0)).toBe('This file is 140 MB. The limit is 100 MB.')
    expect(sizeError(100 * MB, 0)).toBeNull()
  })

  it('rejects files that would push the library past 1 GB', () => {
    expect(sizeError(50 * MB, 1000 * MB)).toBe(MSG.libraryFull)
    expect(sizeError(10 * MB, 900 * MB)).toBeNull()
  })

  it('has the slow-upload note', () => {
    expect(MSG.slow).toBe('Large files can take a while to upload.')
  })
})
