import { bookPath, newBookId, type Book, type Format } from '../storage/manifest'
import type { CoverColors } from '../spines/cover-colors'
import { FILE_LIMIT, FILE_SLOW, LIBRARY_LIMIT } from '../ui/format'
import { checkDrm } from './drm'
import { forFile, MSG } from './messages'
import { PasswordError } from './errors'
import type { BookInfo } from './metadata'
import type { PreviewInput, PreviewResult } from './preview-dialog'
import { sniff } from './sniff'
import { chooseTitle } from './title-clean'

export const ACCEPT = '.pdf,.epub,.mobi,.azw3,application/pdf,application/epub+zip,application/x-mobipocket-ebook'

export interface Candidate {
  file: File
  format: Format
  info: BookInfo
  colors: CoverColors | null
  slow: boolean
}

export type Validation = { ok: true; candidate: Candidate } | { ok: false; message: string }

export interface ValidateDeps {
  readInfo(file: File, format: Format): Promise<BookInfo>
  coverColors(cover: Blob): Promise<CoverColors>
}

/** Checks size limits. `usedBytes` includes the library and earlier queued files. */
export function sizeError(size: number, usedBytes: number): string | null {
  if (size > FILE_LIMIT) return MSG.tooLarge(size)
  if (usedBytes + size > LIBRARY_LIMIT) return MSG.libraryFull
  return null
}

/** Type → size → DRM → metadata → cover colors. */
export async function validateFile(file: File, usedBytes: number, deps: ValidateDeps): Promise<Validation> {
  const s = await sniff(file)
  if ('error' in s) return { ok: false, message: s.error === 'kfx' ? MSG.kfx : MSG.unsupported }
  const sizeMsg = sizeError(file.size, usedBytes)
  if (sizeMsg) return { ok: false, message: sizeMsg }
  try {
    if ((await checkDrm(file, s.format)) === 'drm') return { ok: false, message: MSG.drm }
  } catch {
    return { ok: false, message: MSG.unreadable }
  }
  let info: BookInfo
  try {
    info = await deps.readInfo(file, s.format)
  } catch (e) {
    if (e instanceof PasswordError) return { ok: false, message: MSG.password }
    return { ok: false, message: MSG.unreadable }
  }
  const colors = info.cover ? await deps.coverColors(info.cover).catch(() => null) : null
  return { ok: true, candidate: { file, format: s.format, info, colors, slow: file.size > FILE_SLOW } }
}

export interface QueueDeps extends ValidateDeps {
  usedBytes(): number
  preview(input: PreviewInput): Promise<PreviewResult | null>
  add(book: Book, file: File): Promise<void>
  report(lines: string[]): void
  now?: () => Date
  newId?: () => string
}

/**
 * Validates every file, reports all rejections together, then previews the
 * accepted files one at a time in order. Cancelling one moves to the next.
 */
export async function processFiles(files: File[], deps: QueueDeps): Promise<Book[]> {
  const rejected: string[] = []
  const accepted: Candidate[] = []
  let queued = 0
  for (const file of files) {
    const v = await validateFile(file, deps.usedBytes() + queued, deps)
    if (v.ok) {
      accepted.push(v.candidate)
      queued += file.size
    } else rejected.push(files.length > 1 ? forFile(file.name, v.message) : v.message)
  }
  if (rejected.length) deps.report(rejected)

  const added: Book[] = []
  for (let i = 0; i < accepted.length; i++) {
    const c = accepted[i]
    const id = (deps.newId ?? newBookId)()
    const res = await deps.preview({
      id,
      title: chooseTitle(c.info.title, c.file.name),
      author: c.info.author,
      pages: c.info.pages,
      cover: c.colors,
      queueLabel: accepted.length > 1 ? `Book ${i + 1} of ${accepted.length}` : '',
      note: c.slow ? MSG.slow : undefined,
    })
    if (!res) continue
    const book: Book = {
      id,
      title: res.title,
      ...(res.author ? { author: res.author } : {}),
      format: c.format,
      file: bookPath(id, c.format),
      size: c.file.size,
      addedAt: (deps.now ?? (() => new Date()))().toISOString(),
      length: { pages: c.info.pages, estimated: c.info.estimated },
      cover: c.colors,
      spine: res.spine,
      position: null,
    }
    added.push(book)
    await deps.add(book, c.file)
  }
  return added
}

/** Opens the system file picker. */
export function pickFiles(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = ACCEPT
    input.multiple = true
    input.addEventListener('change', () => resolve(Array.from(input.files ?? [])), { once: true })
    input.addEventListener('cancel', () => resolve([]), { once: true })
    input.click()
  })
}
