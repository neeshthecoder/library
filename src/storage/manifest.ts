export type Format = 'pdf' | 'epub' | 'mobi' | 'azw3'
export type TrimDesign = 'frame' | 'medallion' | 'arch'
export const TRIM_DESIGNS: readonly TrimDesign[] = ['frame', 'medallion', 'arch']

export interface SpineSettings {
  source: 'cover' | 'trim'
  design?: TrimDesign
  /** Background color (hex). */
  bg: string
  /** Trim (or cover accent) color (hex). */
  trim: string
  /** Title ink (hex), always ≥ 4.5:1 against bg. */
  ink: string
  /** Height as a fraction of shelf height. */
  h: number
  /** Width as a fraction of shelf height (before the 44 px floor). */
  w: number
}

export interface Position {
  /** PDF page number as a string, or an EPUB CFI. */
  locator: string
  fraction: number
  label: string
  updatedAt: string
}

export interface Book {
  id: string
  title: string
  format: Format
  file: string
  size: number
  addedAt: string
  length: { pages: number; estimated: boolean }
  cover: { dominant: string; accent: string } | null
  spine: SpineSettings
  position: Position | null
}

export interface Manifest {
  version: 1
  updatedAt: string
  books: Book[]
}

export type Op =
  | { type: 'add'; book: Book }
  | { type: 'delete'; id: string }
  | { type: 'positions'; positions: Record<string, Position> }

export class ManifestVersionError extends Error {
  constructor(public found: unknown) {
    super(`This library was saved by a newer version of the site (manifest version ${String(found)}). Reload to update.`)
  }
}

export const emptyManifest = (): Manifest => ({ version: 1, updatedAt: new Date(0).toISOString(), books: [] })

/** Parses and lightly validates manifest JSON. Throws on unknown major versions. */
export function parseManifest(input: unknown): Manifest {
  const data = typeof input === 'string' ? JSON.parse(input) : input
  if (!data || typeof data !== 'object') throw new Error('The library manifest is not valid JSON.')
  const v = (data as { version?: unknown }).version
  if (v !== 1) throw new ManifestVersionError(v)
  const books = Array.isArray((data as Manifest).books) ? (data as Manifest).books : []
  return {
    version: 1,
    updatedAt: typeof (data as Manifest).updatedAt === 'string' ? (data as Manifest).updatedAt : new Date(0).toISOString(),
    books: books.filter(isBook),
  }
}

function isBook(b: unknown): b is Book {
  const x = b as Book
  return !!x && typeof x.id === 'string' && typeof x.title === 'string' && typeof x.file === 'string'
    && typeof x.format === 'string' && !!x.spine
}

/** Newest `updatedAt` wins. */
export function newerPosition(a: Position | null | undefined, b: Position | null | undefined): Position | null {
  if (!a) return b ?? null
  if (!b) return a
  return Date.parse(b.updatedAt) > Date.parse(a.updatedAt) ? b : a
}

export function addBook(m: Manifest, book: Book, now = new Date().toISOString()): Manifest {
  if (m.books.some((b) => b.id === book.id)) return m
  return { ...m, updatedAt: now, books: [...m.books, book] }
}

export function removeBook(m: Manifest, id: string, now = new Date().toISOString()): Manifest {
  if (!m.books.some((b) => b.id === id)) return m
  return { ...m, updatedAt: now, books: m.books.filter((b) => b.id !== id) }
}

export function setPosition(m: Manifest, id: string, pos: Position, now = new Date().toISOString()): Manifest {
  let changed = false
  const books = m.books.map((b) => {
    if (b.id !== id) return b
    const next = newerPosition(b.position, pos)
    if (next === b.position) return b
    changed = true
    return { ...b, position: next }
  })
  return changed ? { ...m, updatedAt: now, books } : m
}

export function applyOp(m: Manifest, op: Op, now?: string): Manifest {
  switch (op.type) {
    case 'add':
      return addBook(m, op.book, now)
    case 'delete':
      return removeBook(m, op.id, now)
    case 'positions':
      return Object.entries(op.positions).reduce((acc, [id, p]) => setPosition(acc, id, p, now), m)
  }
}

/** Applies pending operations on top of a remote manifest, in order. */
export function merge(remote: Manifest, ops: readonly Op[]): Manifest {
  return ops.reduce((acc, op) => applyOp(acc, op, acc.updatedAt), remote)
}

/** True when the manifest already reflects the operation. */
export function isReflected(m: Manifest, op: Op): boolean {
  switch (op.type) {
    case 'add':
      return m.books.some((b) => b.id === op.book.id)
    case 'delete':
      return !m.books.some((b) => b.id === op.id)
    case 'positions':
      return Object.entries(op.positions).every(([id, p]) => {
        const b = m.books.find((x) => x.id === id)
        if (!b) return true
        return !!b.position && Date.parse(b.position.updatedAt) >= Date.parse(p.updatedAt)
      })
  }
}

export function totalSize(m: Manifest): number {
  return m.books.reduce((n, b) => n + (b.size || 0), 0)
}

/** Books ordered oldest-added first (left) to newest (right). */
export function shelfOrder(books: readonly Book[]): Book[] {
  return [...books].sort((a, b) => Date.parse(a.addedAt) - Date.parse(b.addedAt) || a.id.localeCompare(b.id))
}

const B32 = 'abcdefghijklmnopqrstuvwxyz234567'
export function newBookId(rand: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  return Array.from(rand(10), (x) => B32[x & 31]).join('')
}

export const EXT: Record<Format, string> = { pdf: 'pdf', epub: 'epub', mobi: 'mobi', azw3: 'azw3' }
export const bookPath = (id: string, format: Format) => `library/books/${id}.${EXT[format]}`
export const MANIFEST_PATH = 'library/manifest.json'
