import { describe, expect, it } from 'vitest'
import {
  addBook, cleanAuthor, editBook, setFinished, shelfSections, applyOp, bookPath, isReflected, ManifestVersionError, merge, newBookId, parseManifest, removeBook, setPosition, shelfOrder, totalSize,
  type Book, type Manifest,
} from '../../src/storage/manifest'

const book = (id: string, addedAt = '2026-01-01T00:00:00Z'): Book => ({
  id, title: id, format: 'epub', file: bookPath(id, 'epub'), size: 100, addedAt,
  length: { pages: 10, estimated: true }, cover: null,
  spine: { source: 'trim', design: 'arch', bg: '#000000', trim: '#ffffff', ink: '#ffffff', h: 0.8, w: 0.15 }, position: null,
})
const m0: Manifest = { version: 1, updatedAt: '2026-01-01T00:00:00Z', books: [] }
const pos = (locator: string, updatedAt: string) => ({ locator, fraction: 0.5, label: '50%', updatedAt })

describe('manifest', () => {
  it('parses valid manifests and drops malformed entries', () => {
    const m = parseManifest(JSON.stringify({ version: 1, updatedAt: 'x', books: [book('a'), { nope: true }] }))
    expect(m.books.map((b) => b.id)).toEqual(['a'])
  })

  it('rejects unknown versions with a plain message', () => {
    expect(() => parseManifest({ version: 2, books: [] })).toThrow(ManifestVersionError)
    expect(() => parseManifest({ version: 2, books: [] })).toThrow(/newer version/)
  })

  it('adds idempotently and removes', () => {
    const m1 = addBook(m0, book('a'))
    expect(addBook(m1, book('a'))).toBe(m1)
    expect(removeBook(m1, 'a').books).toEqual([])
    expect(removeBook(m0, 'zzz')).toBe(m0)
  })

  it('keeps the newest position', () => {
    let m = addBook(m0, book('a'))
    m = setPosition(m, 'a', pos('5', '2026-01-02T00:00:00Z'))
    m = setPosition(m, 'a', pos('3', '2026-01-01T12:00:00Z'))
    expect(m.books[0].position?.locator).toBe('5')
    m = setPosition(m, 'a', pos('9', '2026-01-03T00:00:00Z'))
    expect(m.books[0].position?.locator).toBe('9')
  })

  it('merges pending ops so concurrent adds both survive', () => {
    const remote = addBook(m0, book('fromPhone'))
    const merged = merge(remote, [{ type: 'add', book: book('fromLaptop') }])
    expect(merged.books.map((b) => b.id).sort()).toEqual(['fromLaptop', 'fromPhone'])
  })

  it('knows when an op is reflected', () => {
    const m = addBook(m0, book('a'))
    expect(isReflected(m, { type: 'add', book: book('a') })).toBe(true)
    expect(isReflected(m, { type: 'delete', id: 'a' })).toBe(false)
    expect(isReflected(applyOp(m, { type: 'delete', id: 'a' }), { type: 'delete', id: 'a' })).toBe(true)
    const withPos = setPosition(m, 'a', pos('4', '2026-02-01T00:00:00Z'))
    expect(isReflected(withPos, { type: 'positions', positions: { a: pos('4', '2026-02-01T00:00:00Z') } })).toBe(true)
    expect(isReflected(withPos, { type: 'positions', positions: { a: pos('6', '2026-03-01T00:00:00Z') } })).toBe(false)
  })

  it('orders the shelf by date added and totals size', () => {
    const m = { ...m0, books: [book('c', '2026-03-01T00:00:00Z'), book('a', '2026-01-01T00:00:00Z'), book('b', '2026-02-01T00:00:00Z')] }
    expect(shelfOrder(m.books).map((b) => b.id)).toEqual(['a', 'b', 'c'])
    expect(totalSize(m)).toBe(300)
  })

  it('moves books between reading and finished', () => {
    let m = addBook(addBook(addBook(m0, book('a', '2026-01-01T00:00:00Z')), book('b', '2026-01-02T00:00:00Z')), book('c', '2026-01-03T00:00:00Z'))
    m = applyOp(m, { type: 'finish', id: 'c', finishedAt: '2026-03-01T00:00:00Z' })
    m = applyOp(m, { type: 'finish', id: 'a', finishedAt: '2026-03-02T00:00:00Z' })
    const s = shelfSections(m.books)
    expect(s.reading.map((b) => b.id)).toEqual(['b'])
    expect(s.finished.map((b) => b.id)).toEqual(['c', 'a']) // in the order they were finished
    expect(isReflected(m, { type: 'finish', id: 'a', finishedAt: '2026-03-02T00:00:00Z' })).toBe(true)
    m = setFinished(m, 'a', null)
    expect(shelfSections(m.books).reading.map((b) => b.id)).toEqual(['a', 'b'])
    expect(setFinished(m, 'a', null)).toBe(m)
  })

  it('treats books from older manifests as still reading', () => {
    const old = parseManifest({ version: 1, updatedAt: 'x', books: [book('a')] })
    expect(shelfSections(old.books).reading).toHaveLength(1)
  })

  it('parses older manifests without author or font', () => {
    const m = parseManifest({ version: 1, updatedAt: 'x', books: [book('a')] })
    expect(m.books[0].author).toBeUndefined()
    expect(m.books[0].spine.font).toBeUndefined()
  })

  it('edits only the given fields', () => {
    let m = addBook(m0, { ...book('a'), position: pos('5', '2026-01-02T00:00:00Z'), finishedAt: '2026-01-03T00:00:00Z' })
    m = editBook(m, 'a', { title: 'Middlemarch', author: 'George Eliot', spine: { font: 'eb-garamond', bg: '#112233' } }, 'now')
    const b = m.books[0]
    expect(b).toMatchObject({ title: 'Middlemarch', author: 'George Eliot', position: { locator: '5' }, finishedAt: '2026-01-03T00:00:00Z' })
    expect(b.spine).toMatchObject({ font: 'eb-garamond', bg: '#112233', trim: '#ffffff', h: 0.8, w: 0.15 })
    expect(m.updatedAt).toBe('now')
    expect(editBook(m, 'a', { author: null }).books[0].author).toBeNull()
  })

  it('returns the same manifest for a no-op edit', () => {
    const m = addBook(m0, book('a'))
    expect(editBook(m, 'a', { title: 'a', spine: { bg: '#000000' } })).toBe(m)
    expect(editBook(m, 'a', {})).toBe(m)
    expect(editBook(m, 'missing', { title: 'x' })).toBe(m)
    expect(editBook(m, 'a', { author: null })).toBe(m) // absent author counts as none
  })

  it('keeps a newer position when an edit is merged on top', () => {
    const remote = setPosition(addBook(m0, book('a')), 'a', pos('9', '2026-02-01T00:00:00Z'))
    const op = { type: 'edit' as const, id: 'a', changes: { title: 'New' } }
    expect(isReflected(remote, op)).toBe(false)
    const m = merge(remote, [op])
    expect(m.books[0]).toMatchObject({ title: 'New', position: { locator: '9' } })
    expect(isReflected(m, op)).toBe(true)
    expect(isReflected(removeBook(m, 'a'), op)).toBe(true)
  })

  it('cleans authors', () => {
    expect(cleanAuthor('  Ursula   K.\nLe Guin ')).toBe('Ursula K. Le Guin')
    expect(cleanAuthor('   ')).toBeNull()
    expect(cleanAuthor(null)).toBeNull()
    expect(cleanAuthor('x'.repeat(200))).toHaveLength(120)
  })

  it('makes 10-character base32 ids', () => {
    const id = newBookId()
    expect(id).toMatch(/^[a-z2-7]{10}$/)
    expect(newBookId()).not.toBe(id)
  })
})
