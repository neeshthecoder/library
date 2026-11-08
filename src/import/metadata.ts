import type { Format } from '../storage/manifest'
import { openPdf, loadPdfjs } from '../reader/pdfjs'

export interface BookInfo {
  title: string | null
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
    const page = await doc.getPage(1)
    const vp1 = page.getViewport({ scale: 1 })
    const scale = 240 / vp1.height
    const vp = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(vp.width)
    canvas.height = Math.ceil(vp.height)
    await page.render({ canvas, viewport: vp }).promise
    const cover = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
    return { title: normalizeTitle(xmp) ?? normalizeTitle(info), cover, pages: doc.numPages, estimated: false }
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
  book.destroy?.()
  return { title, cover, pages, estimated: true }
}

export function readInfo(file: File, format: Format): Promise<BookInfo> {
  return format === 'pdf' ? readPdfInfo(file) : readEbookInfo(file)
}
