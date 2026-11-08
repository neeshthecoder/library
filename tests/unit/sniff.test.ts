import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseMobiHeader, sniff, sniffBytes } from '../../src/import/sniff'

const fx = (n: string) => readFileSync(fileURLToPath(new URL(`../fixtures/${n}`, import.meta.url)))
const blob = (n: string) => new Blob([fx(n)])

describe('sniff', () => {
  it('identifies formats by signature', async () => {
    expect(await sniff(blob('sample.pdf'))).toEqual({ format: 'pdf' })
    expect(await sniff(blob('sample.epub'))).toEqual({ format: 'epub' })
    expect(await sniff(blob('magi.mobi'))).toEqual({ format: 'mobi' })
    expect(await sniff(blob('magi.azw3'))).toEqual({ format: 'azw3' })
  })

  it('accepts a misnamed EPUB', async () => {
    expect(await sniff(blob('book.zip'))).toEqual({ format: 'epub' })
  })

  it('rejects other files', async () => {
    expect(await sniff(blob('notes.docx'))).toEqual({ error: 'unsupported' })
    expect(await sniff(new Blob(['hello world']))).toEqual({ error: 'unsupported' })
    expect(sniffBytes(new TextEncoder().encode('CONT\x02\x00'))).toEqual({ error: 'kfx' })
  })

  it('reads MOBI headers', () => {
    const h = parseMobiHeader(new Uint8Array(fx('magi.mobi')))!
    expect(h.encryption).toBe(0)
    expect(h.version).toBe(6)
    expect(h.title).toMatch(/Gift of the Magi/i)
  })
})
