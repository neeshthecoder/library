/**
 * Validation for the reading leaderboard's check-ins. Dependency-free so the
 * site's unit tests can import it directly.
 *
 * A check-in is exactly `{bookId, page, pages}` for reader A or M. The book
 * must be in the published catalogue, and the stored title always comes from
 * the catalogue, never from the request.
 */

export const READERS = ['A', 'M'] as const
export type Reader = (typeof READERS)[number]

export interface CatalogueBook {
  id: string
  title: string
}

export interface ReaderRecord {
  bookId: string
  title: string
  page: number
  pages: number
  /** Percent complete, rounded to one decimal place. */
  percent: number
  updatedAt: string
}

export type Board = Record<Reader, ReaderRecord | null>

export type CheckInResult =
  | { ok: true; record: Omit<ReaderRecord, 'updatedAt'> }
  | { ok: false; error: string }

export const MAX_PAGES = 10000
export const MAX_BODY_BYTES = 1024
const BOOK_ID = /^[a-z0-9]{10}$/
const KEYS = ['bookId', 'page', 'pages']

export function parseReader(value: string): Reader | null {
  return (READERS as readonly string[]).includes(value) ? (value as Reader) : null
}

export function percentOf(page: number, pages: number): number {
  return Math.round((page / pages) * 1000) / 10
}

/** Pulls `{id, title}` pairs out of a manifest, skipping anything malformed. */
export function catalogueFrom(manifest: unknown): CatalogueBook[] {
  const books = (manifest as { books?: unknown } | null)?.books
  if (!Array.isArray(books)) return []
  return books.flatMap((b: unknown) => {
    const { id, title } = (b ?? {}) as { id?: unknown; title?: unknown }
    return typeof id === 'string' && typeof title === 'string' ? [{ id, title }] : []
  })
}

export function validateCheckIn(reader: string, body: unknown, catalogue: CatalogueBook[]): CheckInResult {
  const fail = (error: string): CheckInResult => ({ ok: false, error })
  if (!parseReader(reader)) return fail('Unknown reader.')
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('Expected a JSON object.')
  const keys = Object.keys(body)
  if (keys.length !== KEYS.length || !KEYS.every((k) => keys.includes(k))) return fail('Expected exactly bookId, page and pages.')
  const { bookId, page, pages } = body as Record<string, unknown>
  if (typeof bookId !== 'string' || !BOOK_ID.test(bookId)) return fail('Invalid book id.')
  const book = catalogue.find((b) => b.id === bookId)
  if (!book) return fail('That book is not in the catalogue.')
  if (!Number.isInteger(pages) || (pages as number) < 1 || (pages as number) > MAX_PAGES) return fail(`Pages must be a whole number from 1 to ${MAX_PAGES}.`)
  if (!Number.isInteger(page) || (page as number) < 0 || (page as number) > (pages as number)) return fail(`Page must be a whole number from 0 to ${pages as number}.`)
  return {
    ok: true,
    record: { bookId, title: book.title, page: page as number, pages: pages as number, percent: percentOf(page as number, pages as number) },
  }
}

/** Parses a stored record, returning null for anything that doesn't look right. */
export function parseRecord(raw: string | null): ReaderRecord | null {
  if (!raw) return null
  try {
    const r = JSON.parse(raw) as Partial<ReaderRecord>
    const ok =
      typeof r.bookId === 'string' && typeof r.title === 'string' && typeof r.updatedAt === 'string' &&
      Number.isInteger(r.page) && Number.isInteger(r.pages) && typeof r.percent === 'number'
    return ok ? (r as ReaderRecord) : null
  } catch {
    return null
  }
}
