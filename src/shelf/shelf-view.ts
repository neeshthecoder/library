import { shelfOrder, type Book } from '../storage/manifest'
import { leanGap, spineGap, spineLean, spinePx } from '../spines/geometry'
import { renderSpine } from '../spines/spine'
import { canvasMeasure, type Measure } from '../spines/title-fit'
import { libraryReadout } from '../ui/format'
import { bindWheelScroll } from './wheel-scroll'
import { NIGHT_SKY } from './night-sky'

export interface UploadStatus {
  state: 'uploading' | 'failed'
  progress: number
  title: string
}

export interface ShelfState {
  books: Book[]
  totalBytes: number
  uploads: Record<string, UploadStatus>
  loading: boolean
}

export interface ShelfCallbacks {
  onOpen(id: string): void
  onAddBook(): void
  onSettings(): void
  onRetry(id: string): void
}

const SCROLL_KEY = 'shelf-scroll'

export class ShelfView {
  readonly el: HTMLElement
  #list: HTMLUListElement
  #scroller: HTMLElement
  #shelf: HTMLElement
  #empty: HTMLElement
  #readout: HTMLElement
  #status: HTMLElement
  #descs: HTMLElement
  #shelfPx = 0
  #measure: Measure
  #books: Book[] = []
  #renderedKey = ''
  #focusIndex = 0
  #ro: ResizeObserver

  constructor(cb: ShelfCallbacks) {
    this.#measure = canvasMeasure()
    this.el = document.createElement('main')
    this.el.className = 'shelf-page'
    this.el.innerHTML = `
      <div class="night-sky" aria-hidden="true">${NIGHT_SKY}</div>
      <header class="shelf-header">
        <h1 class="display display-xl headline-enter">The bookshelf.</h1>
        <p class="fine shelf-subtitle">Books I am (or should be) reading.</p>
      </header>
      <section class="shelf" aria-label="Shelf">
        <div class="shelf-scroller">
          <div class="bookcase">
            <div class="bookcase-back">
              <ul class="shelf-books" role="list"></ul>
            </div>
            <div class="bookcase-plank" aria-hidden="true"></div>
          </div>
        </div>
      </section>
      <p class="shelf-empty" hidden>Drop a book anywhere to add it.</p>
      <div class="fine shelf-status" role="status"></div>
      <footer class="shelf-footer fine">
        <button type="button" class="link-btn" data-action="add">Add book</button>
        <span class="shelf-size"></span>
        <button type="button" class="link-btn" data-action="settings">Library settings</button>
      </footer>
      <div class="visually-hidden shelf-descs"></div>`
    this.#list = this.el.querySelector('.shelf-books')!
    this.#scroller = this.el.querySelector('.shelf-scroller')!
    this.#shelf = this.el.querySelector('.shelf')!
    this.#empty = this.el.querySelector('.shelf-empty')!
    this.#readout = this.el.querySelector('.shelf-size')!
    this.#status = this.el.querySelector('.shelf-status')!
    this.#descs = this.el.querySelector('.shelf-descs')!

    this.el.querySelector('[data-action="add"]')!.addEventListener('click', () => cb.onAddBook())
    this.el.querySelector('[data-action="settings"]')!.addEventListener('click', () => cb.onSettings())
    this.#status.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-retry]')
      if (btn) cb.onRetry(btn.dataset.retry!)
    })

    bindWheelScroll(this.#scroller)
    this.#list.addEventListener('keydown', (e) => this.#onKey(e))
    this.#list.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.spine')
      if (btn) cb.onOpen(btn.dataset.id!)
    })
    this.#list.addEventListener('focusin', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.spine')
      if (btn) this.#setRoving(this.#indexOf(btn.dataset.id!))
    })
    this.#scroller.addEventListener('scroll', () => {
      try { sessionStorage.setItem(SCROLL_KEY, String(this.#scroller.scrollLeft)) } catch { /* ignore */ }
    }, { passive: true })

    this.#ro = new ResizeObserver(([entry]) => {
      const px = Math.round(entry.contentRect.height)
      if (px && px !== this.#shelfPx) {
        this.#shelfPx = px
        this.#renderedKey = ''
        this.#renderBooks()
      }
    })
    this.#ro.observe(this.#list)
    document.fonts?.ready.then(() => {
      this.#measure = canvasMeasure()
      this.#renderedKey = ''
      this.#renderBooks()
    })
  }

  update(state: ShelfState): void {
    this.#books = shelfOrder(state.books)
    const empty = !state.loading && this.#books.length === 0
    this.#shelf.hidden = empty
    this.#empty.hidden = !empty
    this.#readout.textContent = libraryReadout(this.#books.length, state.totalBytes).text
    this.#renderStatus(state.uploads)
    this.#renderBooks()
  }

  /** Restores the shelf scroll position saved this session. */
  restoreScroll(): void {
    try {
      const v = Number(sessionStorage.getItem(SCROLL_KEY))
      if (v) this.#scroller.scrollLeft = v
    } catch { /* ignore */ }
  }

  focusSpine(id: string): void {
    const btn = this.#button(id)
    if (!btn) return
    this.#setRoving(this.#indexOf(id))
    btn.focus({ preventScroll: true })
    btn.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }

  revealSpine(id: string): void {
    this.#button(id)?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }

  destroy(): void {
    this.#ro.disconnect()
  }

  #button(id: string) {
    return this.#list.querySelector<HTMLButtonElement>(`.spine[data-id="${CSS.escape(id)}"]`)
  }

  #indexOf(id: string) {
    return Math.max(0, this.#books.findIndex((b) => b.id === id))
  }

  #renderBooks(): void {
    if (!this.#shelfPx) return
    const key = this.#shelfPx + '|' + this.#books
      .map((b) => [b.id, b.title, JSON.stringify(b.spine), !!b.position, b.position?.label].join('~'))
      .join('|')
    if (key === this.#renderedKey) return
    this.#renderedKey = key
    const hadFocus = this.#list.contains(document.activeElement)
    const focusedId = hadFocus ? (document.activeElement as HTMLElement).dataset.id : undefined

    this.#list.replaceChildren()
    this.#descs.replaceChildren()
    this.#focusIndex = Math.min(this.#focusIndex, Math.max(0, this.#books.length - 1))
    let prevLeaned = false
    this.#books.forEach((book, i) => {
      const li = document.createElement('li')
      const lean = spineLean(book.id, i === this.#books.length - 1, prevLeaned)
      prevLeaned = lean > 0
      const px = spinePx(book.spine.h, book.spine.w, this.#shelfPx)
      li.style.marginRight = `${spineGap(book.id) + leanGap(px.height, px.width, lean)}px`
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'spine'
      btn.dataset.id = book.id
      btn.setAttribute('aria-label', book.title)
      btn.title = book.title
      btn.tabIndex = i === this.#focusIndex ? 0 : -1
      if (book.position) {
        const desc = document.createElement('span')
        desc.id = `spine-desc-${book.id}`
        desc.textContent = `In progress, ${book.position.label}`
        this.#descs.append(desc)
        btn.setAttribute('aria-describedby', desc.id)
      }
      renderSpine(btn, { id: book.id, title: book.title, spine: book.spine, started: !!book.position }, this.#shelfPx, this.#measure)
      if (lean) {
        btn.style.setProperty('--lean', `${lean}deg`)
        btn.dataset.lean = 'true'
      }
      li.append(btn)
      this.#list.append(li)
    })
    if (focusedId) this.#button(focusedId)?.focus({ preventScroll: true })
  }

  #renderStatus(uploads: Record<string, UploadStatus>): void {
    this.#status.replaceChildren()
    for (const [id, u] of Object.entries(uploads)) {
      const p = document.createElement('p')
      p.className = 'shelf-status-line'
      if (u.state === 'uploading') {
        p.textContent = `Uploading ${u.title}… ${Math.round(u.progress * 100)}%`
      } else {
        p.append(`${u.title} isn’t uploaded yet. `)
        const b = document.createElement('button')
        b.type = 'button'
        b.className = 'link-btn'
        b.dataset.retry = id
        b.textContent = 'Retry upload'
        p.append(b)
      }
      this.#status.append(p)
    }
  }

  #setRoving(index: number): void {
    this.#focusIndex = index
    this.#list.querySelectorAll<HTMLButtonElement>('.spine').forEach((b, i) => (b.tabIndex = i === index ? 0 : -1))
  }

  #onKey(e: KeyboardEvent): void {
    const n = this.#books.length
    if (!n) return
    let i = this.#focusIndex
    if (e.key === 'ArrowRight') i = Math.min(n - 1, i + 1)
    else if (e.key === 'ArrowLeft') i = Math.max(0, i - 1)
    else if (e.key === 'Home') i = 0
    else if (e.key === 'End') i = n - 1
    else return
    e.preventDefault()
    this.focusSpine(this.#books[i].id)
  }
}
