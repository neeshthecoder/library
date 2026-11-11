import { cleanAuthor, type Format } from '../storage/manifest'
import { openPdf, loadPdfjs } from '../reader/pdfjs'

export interface BookInfo {
  title: string | null
  /** Joined with ", " when there are several. */
  author: string | null
  cover: Blob | null
  pages: number
  estimated: boolean
}

import { PasswordError, UnreadableError } from './errors'
export { PasswordError, UnreadableError }

/** Roughly 2,500 bytes of XHTML per printed page. */
export const BYTES_PER_PAGE = 2500

export function normalizeTitle(t: unknown): string | null {
  if (typeof t === 'string') return t.trim() || null
  if (t && typeof t === 'object') {
    const vals = Object.values(t as Record<string, unknown>).filter((v): v is string => typeof v === 'string')
    return vals[0]?.trim() || null
  }
  return null
}

/** Author metadata that means "nobody in particular". */
const JUNK_AUTHORS = new Set(['unknown', 'unknown author', 'anonymous author', 'administrator', 'admin', 'user', 'author', 'owner', 'n/a', 'none'])

/** Pulls names out of a string, localized-string object, `{ name }` contributor, or an array of these. */
function authorNames(v: unknown): string[] {
  if (typeof v === 'string') return [v]
  if (Array.isArray(v)) return v.flatMap(authorNames)
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    if ('name' in o) return authorNames(o.name)
    return authorNames(Object.values(o).find((x) => typeof x === 'string'))
  }
  return []
}

/**
 * Turns any author metadata into one display string: names deduplicated and
 * joined with ", ", whitespace collapsed, at most MAX_AUTHOR characters.
 * Empty or placeholder values give null.
 */
export function normalizeAuthor(v: unknown): string | null {
  const seen = new Set<string>()
  const names: string[] = []
  for (const raw of authorNames(v)) {
    const name = raw.replace(/\s+/g, ' ').trim()
    const key = name.toLowerCase()
    if (!name || JUNK_AUTHORS.has(key) || seen.has(key)) continue
    seen.add(key)
    names.push(name)
  }
  return cleanAuthor(names.join(', '))
}

export async function readPdfInfo(file: Blob): Promise<BookInfo> {
  const pdfjs = await loadPdfjs()
  let doc
  try {
    doc = await openPdf(file)
  } catch (e) {
    if (e instanceof pdfjs.PasswordException || (e as Error)?.name === 'PasswordException') throw new PasswordError()
    throw new UnreadableError()
  }
  try {
    const meta = await doc.getMetadata().catch(() => null)
    const xmp = meta?.metadata?.get('dc:title')
    const info = (meta?.info as { Title?: string } | undefined)?.Title
    const author = normalizeAuthor(meta?.metadata?.get('dc:creator')) ?? normalizeAuthor((meta?.info as { Author?: unknown } | undefined)?.Author)
    const page = await doc.getPage(1)
    const vp1 = page.getViewport({ scale: 1 })
    const scale = 240 / vp1.height
    const vp = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(vp.width)
    canvas.height = Math.ceil(vp.height)
    await page.render({ canvas, viewport: vp }).promise
    const cover = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
    return { title: normalizeTitle(xmp) ?? normalizeTitle(info), author, cover, pages: doc.numPages, estimated: false }
  } finally {
    void doc.loadingTask.destroy()
  }
}

export async function readEbookInfo(file: File): Promise<BookInfo> {
  const { makeBook } = await import('@vendor/foliate-js/view.js')
  let book
  try {
    book = await makeBook(file)
  } catch {
    throw new UnreadableError()
  }
  const cover = (await book.getCover?.().catch(() => null)) ?? null
  const bytes = book.sections.reduce((n, s) => n + (s.linear === 'no' ? 0 : s.size || 0), 0)
  const pages = Math.max(1, Math.round(bytes / BYTES_PER_PAGE))
  const title = normalizeTitle(book.metadata?.title)
  const author = normalizeAuthor((book.metadata as { author?: unknown } | undefined)?.author)
  book.destroy?.()
  return { title, author, cover, pages, estimated: true }
}

export function readInfo(file: File, format: Format): Promise<BookInfo> {
  return format === 'pdf' ? readPdfInfo(file) : readEbookInfo(file)
}
