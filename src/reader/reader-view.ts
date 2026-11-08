import type { Book } from '../storage/manifest'
import type { Library } from '../storage/library'
import { createDialog, esc, openDialog } from '../ui/dialog'
import { ICON_BACK, ICON_TRASH } from '../ui/icons'
import { showMessages } from '../ui/messages'
import type { BookRenderer, Location } from './renderer'
import { currentMode, SPREAD_QUERY, type Mode } from './spread'

export interface ReaderCallbacks {
  onBack(): void
  onDeleted(book: Book): void
  onPageTurn(): void
  /** Ensures a connection; resolves false if the user declined. */
  ensureConnected(reason: string): Promise<boolean>
}

export function deleteMessage(title: string) {
  return { title: `Delete ${title}?`, body: 'This removes the file from your library.' }
}

export async function confirmDelete(title: string): Promise<boolean> {
  const m = deleteMessage(title)
  const d = createDialog('delete-title')
  d.setAttribute('role', 'alertdialog')
  d.setAttribute('aria-describedby', 'delete-body')
  d.innerHTML = `
    <h2 class="dialog-title" id="delete-title">${esc(m.title)}</h2>
    <p class="dialog-body" id="delete-body">${esc(m.body)}</p>
    <div class="dialog-actions">
      <button type="button" class="btn btn-secondary" data-v="cancel">Cancel</button>
      <button type="button" class="btn btn-primary" data-v="delete">Delete</button>
    </div>`
  d.addEventListener('click', (e) => {
    const v = (e.target as HTMLElement).closest<HTMLElement>('[data-v]')?.dataset.v
    if (v) d.close(v)
  })
  return (await openDialog(d, d.querySelector<HTMLElement>('[data-v="cancel"]'))) === 'delete'
}

export class ReaderView {
  readonly el: HTMLElement
  #book: Book
  #lib: Library
  #cb: ReaderCallbacks
  #renderer: BookRenderer | null = null
  #stage: HTMLElement
  #bookEl: HTMLElement
  #status: HTMLElement
  #progress: HTMLElement
  #mql = matchMedia(SPREAD_QUERY)
  #initialLocator: string | null = null
  #moved = false
  #chain: Promise<void> = Promise.resolve()
  #queued = 0
  #destroyed = false

  constructor(book: Book, lib: Library, cb: ReaderCallbacks) {
    this.#book = book
    this.#lib = lib
    this.#cb = cb
    this.el = document.createElement('div')
    this.el.className = 'reader'
    this.el.innerHTML = `
      <header class="reader-bar">
        <button type="button" class="icon-btn" data-back aria-label="Back to shelf">${ICON_BACK}<span aria-hidden="true">Shelf</span></button>
        <p class="fine reader-progress" aria-live="polite"></p>
        <button type="button" class="icon-btn" data-delete aria-label="Delete book">${ICON_TRASH}</button>
      </header>
      <main class="reader-stage" data-format="${book.format}">
        <h1 class="visually-hidden">${esc(book.title)}</h1>
        <div class="reader-book"></div>
        <button type="button" class="reader-edge reader-edge-prev" aria-label="Previous page"></button>
        <button type="button" class="reader-edge reader-edge-next" aria-label="Next page"></button>
        <div class="reader-status" role="status"><p class="fine">Opening ${esc(book.title)}…</p></div>
      </main>`
    this.#stage = this.el.querySelector('.reader-stage')!
    this.#bookEl = this.el.querySelector('.reader-book')!
    this.#status = this.el.querySelector('.reader-status')!
    this.#progress = this.el.querySelector('.reader-progress')!

    this.el.querySelector('[data-back]')!.addEventListener('click', () => cb.onBack())
    const del = this.el.querySelector<HTMLElement>('[data-delete]')!
    del.hidden = !lib.isOwner
    del.addEventListener('click', () => void this.#delete())
    this.el.querySelector('.reader-edge-prev')!.addEventListener('click', () => void this.prev())
    this.el.querySelector('.reader-edge-next')!.addEventListener('click', () => void this.next())
    this.#mql.addEventListener('change', this.#onMode)
    document.addEventListener('keydown', this.#onKey)
  }

  async open(): Promise<void> {
    const blob = await this.#lib.getFile(this.#book).catch(() => null)
    if (this.#destroyed) return
    if (!blob) return this.#fail('This book’s file couldn’t be loaded. Check your connection and try again.')
    const pos = this.#lib.position(this.#book.id)
    this.#initialLocator = pos?.locator ?? null
    const opts = {
      container: this.#bookEl,
      blob,
      name: this.#book.file.split('/').pop() ?? 'book',
      mode: currentMode(),
      onRelocate: (loc: Location) => this.#onRelocate(loc),
      onKey: (e: KeyboardEvent) => this.#onKey(e),
    }
    try {
      if (this.#book.format === 'pdf') {
        const { PdfRenderer } = await import('./pdf-reader')
        this.#renderer = new PdfRenderer(opts)
      } else {
        const { FoliateRenderer } = await import('./foliate-reader')
        this.#renderer = new FoliateRenderer(opts)
      }
      if (this.#destroyed) return
      await this.#renderer.open(pos?.locator ?? null, pos?.fraction ?? null)
      if (this.#destroyed) return
      this.#status.replaceChildren()
      this.#stage.dataset.ready = 'true'
    } catch {
      this.#fail('This book couldn’t be opened. The file may be damaged.')
    }
  }

  next(): Promise<void> {
    return this.#turn((r) => r.next())
  }

  prev(): Promise<void> {
    return this.#turn((r) => r.prev())
  }

  /** Serializes page turns so quick key presses aren't lost (at most 3 queued). */
  #turn(fn: (r: BookRenderer) => Promise<boolean>): Promise<void> {
    if (!this.#renderer || this.#queued >= 3) return this.#chain
    this.#queued++
    this.#chain = this.#chain
      .then(() => (this.#renderer ? fn(this.#renderer) : false))
      .catch(() => false)
      .then(() => { this.#queued-- })
    return this.#chain
  }

  destroy(): void {
    this.#destroyed = true
    document.removeEventListener('keydown', this.#onKey)
    this.#mql.removeEventListener('change', this.#onMode)
    this.#renderer?.destroy()
    this.#renderer = null
  }

  #fail(message: string): void {
    this.#status.innerHTML = `<div class="reader-error"><p class="message">${esc(message)}</p>
      <button type="button" class="btn btn-secondary" data-back-err>Back to shelf</button></div>`
    this.#status.querySelector('[data-back-err]')!.addEventListener('click', () => this.#cb.onBack())
    this.#stage.dataset.error = 'true'
  }

  #onRelocate(loc: Location): void {
    this.#progress.textContent = loc.label
    if (!this.#moved && loc.locator === this.#initialLocator) return
    if (!this.#moved && this.#initialLocator === null) {
      // the first relocation on a never-opened book is just opening it
      this.#initialLocator = loc.locator
      return
    }
    this.#moved = true
    void this.#lib.savePosition(this.#book.id, { ...loc, updatedAt: new Date().toISOString() })
    this.#cb.onPageTurn()
  }

  #onMode = () => {
    void this.#renderer?.setMode(this.#mql.matches ? 'spread' : ('single' as Mode))
  }

  #onKey = (e: KeyboardEvent) => {
    if (document.querySelector('dialog[open]')) return
    const t = e.target as HTMLElement | null
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
    if (e.altKey || e.ctrlKey || e.metaKey) return
    if (e.key === 'ArrowRight') { e.preventDefault(); void this.next() }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); void this.prev() }
    else if (e.key === 'Escape') { e.preventDefault(); this.#cb.onBack() }
  }

  async #delete(): Promise<void> {
    const uploaded = this.#lib.store.get().published?.books.some((b) => b.id === this.#book.id)
    if (uploaded && !this.#lib.connected) {
      const ok = await this.#cb.ensureConnected('Connect your library to delete books.')
      if (!ok) return
    }
    if (!(await confirmDelete(this.#book.title))) return
    try {
      await this.#lib.delete(this.#book.id)
      this.#cb.onDeleted(this.#book)
    } catch (e) {
      showMessages([`${this.#book.title} couldn’t be deleted. ${e instanceof Error ? e.message : ''}`.trim()])
    }
  }
}
