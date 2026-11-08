import { describe, expect, it } from 'vitest'
import { hrefFor, parseHash } from '../../src/router'

describe('parseHash', () => {
  it('treats empty and root hashes as the shelf', () => {
    expect(parseHash('')).toEqual({ name: 'shelf' })
    expect(parseHash('#/')).toEqual({ name: 'shelf' })
    expect(parseHash('#')).toEqual({ name: 'shelf' })
  })

  it('parses reader routes', () => {
    expect(parseHash('#/read/k3f9x2m7qp')).toEqual({ name: 'reader', id: 'k3f9x2m7qp' })
    expect(parseHash('#/read/k3f9x2m7qp/')).toEqual({ name: 'reader', id: 'k3f9x2m7qp' })
  })

  it('falls back to the shelf for unknown or malformed routes', () => {
    expect(parseHash('#/settings')).toEqual({ name: 'shelf' })
    expect(parseHash('#/read/')).toEqual({ name: 'shelf' })
    expect(parseHash('#/read/../../etc')).toEqual({ name: 'shelf' })
  })

  it('round-trips through hrefFor', () => {
    expect(parseHash(hrefFor({ name: 'reader', id: 'abc' }))).toEqual({ name: 'reader', id: 'abc' })
    expect(hrefFor({ name: 'shelf' })).toBe('#/')
  })
})
