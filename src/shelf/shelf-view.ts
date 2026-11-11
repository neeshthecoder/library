import { cleanAuthor, shelfSections, type Book } from '../storage/manifest'
import { leanGap, spineGap, spineLean, spinePx } from '../spines/geometry'
import { renderSpine } from '../spines/spine'
import { fontMeasures } from '../spines/title-fit'
import { fontFor, loadFont } from '../spines/fonts'
import { libraryReadout } from '../ui/format'
import { setThemeOverride } from '../theme'
import { bindWheelScroll } from './wheel-scroll'
import { NIGHT_SKY } from './night-sky'
import { DAY_SKY } from './day-sky'
import { BOOKEND_SVG, BOOKEND_VIEWBOX } from './bookend'
import { critterAfter, critterItem, type CritterKind, type CritterRole } from './critters'
import { LEADERBOARD_URL } from '../leaderboard/config'

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
  /** Connected owner (can add and manage) or a read-only guest. */
  owner: boolean
}

export interface ShelfCallbacks {
  onOpen(id: string): void
  onAddBook(): void
  onSettings(): void
  onRetry(id: string): void
  onSignIn(): void
  /** Owner dragged a book across the divider. */
  onMove(id: string, finished: boolean): void
  /** The leaderboard acorns were clicked. */
  onLeaderboard(): void
  /** Owner chose "Edit" from a spine's context menu. */
  onEdit?(id: string): void
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
  #measures = fontMeasures()
  /** Fonts already loaded, or loading with a re-fit queued. */
  #fontsSeen = new Set<string>()
  #books: Book[] = []
  #renderedKey = ''
  #focusIndex = 0
  #ro: ResizeObserver
  #themeObserver!: MutationObserver
  #owner = false
  #finishedIds = new Set<string>()
  #bookcase!: HTMLElement
  #engraving!: HTMLElement
  #top!: HTMLElement
  #onMove: (id: string, finished: boolean) => void
  #onEdit?: (id: string) => void
  /** The open spine context menu, and the spine it belongs to. */
  #menu: { el: HTMLElement; spine: HTMLButtonElement; dispose: () => void } | null = null
  #drag: {
    id: string
    btn: HTMLButtonElement
    pointerId: number
    touch: boolean
    startX: number
    startY: number
    x: number
    active: boolean
    timer?: number
    ghost?: HTMLElement
    offX: number
    offY: number
    /** Farthest the pointer has moved from the press, in px. */
    moved?: number
  } | null = null
  #suppressClick = false
  #raf = 0

  constructor(cb: ShelfCallbacks) {
    this.el = document.createElement('main')
    this.el.className = 'shelf-page'
    this.el.innerHTML = `
      <div class="night-sky" aria-hidden="true">${NIGHT_SKY}</div>
      <div class="day-sky" aria-hidden="true">${DAY_SKY}</div>
      <header class="shelf-header">
        <h1 class="display display-xl headline-enter">The bookshelf.</h1>
        <p class="fine shelf-subtitle">Books Avaneesh is (or should be) reading.</p>
      </header>
      <section class="shelf" aria-label="Shelf">
        <div class="shelf-scroller">
          <div class="bookcase">
            <div class="bookcase-back">
              <ul class="shelf-books" role="list"></ul>
            </div>
            <div class="bookcase-top"></div>
            <div class="bookcase-plank" aria-hidden="true"><p class="plank-engraving">Finished</p></div>
            <div class="drop-zone-hint reading-zone-hint" aria-hidden="true"></div>
            <div class="drop-zone-hint finished-zone-hint" aria-hidden="true"></div>
          </div>
        </div>
      </section>
      <p class="shelf-empty" hidden>Drop a book anywhere to add it.</p>
      <div class="fine shelf-status" role="status"></div>
      <footer class="shelf-footer fine">
        <button type="button" class="link-btn" data-action="add">Add book</button>
        <span class="shelf-size"></span>
        <button type="button" class="link-btn" data-action="settings">Library settings</button>
        <button type="button" class="link-btn" data-action="signin">Sign in</button>
      </footer>
      <div class="visually-hidden shelf-descs"></div>`
    this.#list = this.el.querySelector('.shelf-books')!
    this.#scroller = this.el.querySelector('.shelf-scroller')!
    this.#shelf = this.el.querySelector('.shelf')!
    this.#empty = this.el.querySelector('.shelf-empty')!
    this.#readout = this.el.querySelector('.shelf-size')!
    this.#status = this.el.querySelector('.shelf-status')!
    this.#descs = this.el.querySelector('.shelf-descs')!
    this.#bookcase = this.el.querySelector('.bookcase')!
    this.#engraving = this.el.querySelector('.plank-engraving')!
    this.#top = this.el.querySelector('.bookcase-top')!
    this.#onMove = cb.onMove
    this.#onEdit = cb.onEdit
    this.#bindDrag()
    this.#bindMenu()

    this.el.querySelector('[data-action="add"]')!.addEventListener('click', () => cb.onAddBook())
    this.el.querySelector('[data-action="settings"]')!.addEventListener('click', () => cb.onSettings())
    this.el.querySelector('[data-action="signin"]')!.addEventListener('click', () => cb.onSignIn())
    // The first squirrel (with its "Click Me!" sign) is the day/night toggle:
    // flip the theme and keep it. The squirrel is re-created on each render, so
    // the click is delegated and its switch state kept in step with the theme.
    this.#top.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      if (target.closest('.critter-toggle')) {
        setThemeOverride(document.documentElement.dataset.theme === 'night' ? 'day' : 'night')
      } else if (target.closest('.critter-leaderboard')) {
        cb.onLeaderboard()
      }
    })
    this.#themeObserver = new MutationObserver(() => this.#syncToggle())
    this.#themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    this.#status.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-retry]')
      if (btn) cb.onRetry(btn.dataset.retry!)
    })

    bindWheelScroll(this.#scroller)
    this.#list.addEventListener('keydown', (e) => this.#onKey(e))
    this.#list.addEventListener('click', (e) => {
      // keyboard activation (detail 0) always opens; a pointer release after a drag doesn't
      if (this.#suppressClick && (e as MouseEvent).detail !== 0) {
        this.#suppressClick = false
        e.preventDefault()
        return
      }
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.spine')
      if (btn) cb.onOpen(btn.dataset.id!)
    })
    this.#list.addEventListener('focusin', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.spine')
      if (btn) this.#setRoving(this.#indexOf(btn.dataset.id!))
    })
    this.#scroller.addEventListener('scroll', () => {
      this.closeMenu(false)
      try { sessionStorage.setItem(SCROLL_KEY, String(this.#scroller.scrollLeft)) } catch { /* ignore */ }
    }, { passive: true })

    this.#ro = new ResizeObserver(([entry]) => {
      const px = Math.round(entry.contentRect.height)
      if (!px) return // detached or hidden: keep the last good size, don't reflow to zero
      if (px !== this.#shelfPx) {
        this.#shelfPx = px
        this.#renderedKey = ''
        this.#renderBooks()
      } else {
        // Same size (e.g. the shelf was just re-shown after the reader): the
        // books flow back on their own, but the absolutely-placed decor needs
        // repositioning against fresh geometry.
        requestAnimationFrame(() => this.#layoutDecor())
      }
    })
    this.#ro.observe(this.#list)
    document.fonts?.ready.then(() => {
      this.#measures.reset()
      this.#renderedKey = ''
      this.#renderBooks()
    })
  }

  update(state: ShelfState): void {
    const { reading, finished } = shelfSections(state.books)
    this.#books = [...reading, ...finished]
    this.#finishedIds = new Set(finished.map((b) => b.id))
    this.#owner = state.owner
    this.#bookcase.dataset.owner = String(state.owner)
    const empty = !state.loading && this.#books.length === 0
    this.#shelf.hidden = empty
    this.#empty.hidden = !empty
    this.#empty.textContent = state.owner ? 'Drop a book anywhere to add it.' : 'No books on the shelf yet.'
    for (const a of ['add', 'settings']) this.el.querySelector<HTMLElement>(`[data-action="${a}"]`)!.hidden = !state.owner
    this.el.querySelector<HTMLElement>('[data-action="signin"]')!.hidden = state.owner
    this.#readout.textContent = libraryReadout(this.#books.length, state.totalBytes).text
    this.#renderStatus(state.uploads)
    this.#renderBooks()
    // #renderBooks skips re-rendering when the book list is unchanged, so after
    // returning to the shelf its decor would keep stale positions. Reposition it
    // against the now-live geometry.
    requestAnimationFrame(() => this.#layoutDecor())
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
    this.#themeObserver.disconnect()
  }

  #button(id: string) {
    return this.#list.querySelector<HTMLButtonElement>(`.spine[data-id="${CSS.escape(id)}"]`)
  }

  #indexOf(id: string) {
    return Math.max(0, this.#books.findIndex((b) => b.id === id))
  }

  /** Re-fits a font's spines once that font arrives; each font is waited on once. */
  #loadFonts(): void {
    for (const book of this.#books) {
      const f = fontFor(book.spine.font)
      if (this.#fontsSeen.has(f.id)) continue
      this.#fontsSeen.add(f.id)
      loadFont(f)?.then(() => {
        this.#measures.reset(f.id)
        this.#renderedKey = ''
        this.#renderBooks()
      })
    }
  }

  #renderBooks(): void {
    if (!this.#shelfPx) return
    const key = this.#shelfPx + '|' + this.#books
      .map((b) => [b.id, b.title, b.author ?? '', JSON.stringify(b.spine), !!b.position, b.position?.label, this.#finishedIds.has(b.id)].join('~'))
      .join('|')
    if (key === this.#renderedKey) return
    this.#renderedKey = key
    this.closeMenu(false)
    const hadFocus = this.#list.contains(document.activeElement)
    const focusedId = hadFocus ? (document.activeElement as HTMLElement).dataset.id : undefined

    this.#list.replaceChildren()
    this.#descs.replaceChildren()
    this.#focusIndex = Math.min(this.#focusIndex, Math.max(0, this.#books.length - 1))
    const reading = this.#books.filter((b) => !this.#finishedIds.has(b.id))
    const finished = this.#books.filter((b) => this.#finishedIds.has(b.id))

    const critters: { kind: CritterKind; id: string }[] = []
    const section = (books: Book[], isFinished: boolean, offset: number) => {
      let prevLeaned = false
      books.forEach((book, j) => {
        const i = offset + j
        const li = document.createElement('li')
        const critter = critterAfter(i + 1)
        if (critter) critters.push({ kind: critter, id: book.id })
        const lean = spineLean(book.id, j === books.length - 1, prevLeaned)
        prevLeaned = lean > 0
        const px = spinePx(book.spine.h, book.spine.w, this.#shelfPx)
        li.style.marginRight = `${spineGap(book.id) + leanGap(px.height, px.width, lean)}px`
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'spine'
        btn.dataset.id = book.id
        btn.dataset.section = isFinished ? 'finished' : 'reading'
        btn.draggable = false
        const author = cleanAuthor(book.author)
        // The name must contain the visible text ("Emma" + "Jane Austen") for
        // speech input, so the author follows a comma; the tooltip says "by".
        btn.setAttribute('aria-label', author ? `${book.title}, ${author}` : book.title)
        btn.title = author ? `${book.title} by ${author}` : book.title
        btn.tabIndex = i === this.#focusIndex ? 0 : -1
        const descText = isFinished ? 'Finished' : book.position ? `In progress, ${book.position.label}` : ''
        if (descText) {
          const desc = document.createElement('span')
          desc.id = `spine-desc-${book.id}`
          desc.textContent = descText
          this.#descs.append(desc)
          btn.setAttribute('aria-describedby', desc.id)
        }
        renderSpine(btn, { id: book.id, title: book.title, author, spine: book.spine, started: !isFinished && !!book.position }, this.#shelfPx, this.#measures.get(book.spine.font))
        if (lean) {
          btn.style.setProperty('--lean', `${lean}deg`)
          btn.dataset.lean = 'true'
        }
        li.append(btn)
        this.#list.append(li)
      })
    }

    this.#loadFonts()
    section(reading, false, 0)
    const end = document.createElement('li')
    end.className = 'bookend'
    end.setAttribute('aria-hidden', 'true')
    const h = Math.round(this.#shelfPx * 0.96)
    end.style.height = `${h}px`
    end.style.width = `${Math.round((h * BOOKEND_VIEWBOX.w) / BOOKEND_VIEWBOX.h)}px`
    end.innerHTML = BOOKEND_SVG
    this.#list.append(end)
    section(finished, true, reading.length)
    const spacer = document.createElement('li')
    spacer.className = 'finished-spacer'
    spacer.setAttribute('aria-hidden', 'true')
    if (!finished.length) spacer.dataset.empty = ''
    this.#list.append(spacer)

    // The first squirrel toggles the theme; the first acorn pair opens the
    // reading leaderboard, when one is configured.
    const acorns = LEADERBOARD_URL ? critters.findIndex((c) => c.kind === 'acorns') : -1
    this.#top.replaceChildren(...critters.map((c, idx) => {
      const role: CritterRole | undefined = idx === 0 ? 'theme-toggle' : idx === acorns ? 'leaderboard' : undefined
      const el = critterItem(c.kind, this.#shelfPx, role)
      el.dataset.over = c.id
      return el
    }))
    this.#syncToggle()

    if (focusedId) this.#button(focusedId)?.focus({ preventScroll: true })
    requestAnimationFrame(() => this.#layoutDecor())
  }

  /** Reflects the live theme on the squirrel toggle (role="switch"). */
  #syncToggle(): void {
    this.#top.querySelector('.critter-toggle')?.setAttribute('aria-checked', String(document.documentElement.dataset.theme === 'night'))
  }

  /** Places the engraving and the drop-zone hints relative to the bookend. */
  #layoutDecor(): void {
    const end = this.#list.querySelector<HTMLElement>('li.bookend')
    if (!end) return
    const caseBox = this.#bookcase.getBoundingClientRect()
    // Bail while the shelf has no layout (detached, or hidden in the reader):
    // every rect would be zero and the decor would collapse into the corner.
    if (!caseBox.width) return
    const endBox = end.getBoundingClientRect()
    const back = this.#bookcase.querySelector<HTMLElement>('.bookcase-back')!.getBoundingClientRect()
    const finishedLeft = endBox.right - caseBox.left
    const finishedWidth = back.right - endBox.right
    Object.assign(this.#engraving.style, { left: `${finishedLeft}px`, width: `${finishedWidth}px` })
    const fin = this.#bookcase.querySelector<HTMLElement>('.finished-zone-hint')!
    Object.assign(fin.style, { left: `${finishedLeft}px`, width: `${finishedWidth}px` })
    // critters stand on the top board, each centred over its book
    for (const c of this.#top.querySelectorAll<HTMLElement>('.critter')) {
      const book = this.#button(c.dataset.over!)?.parentElement
      if (!book) continue
      const b = book.getBoundingClientRect()
      c.style.left = `${b.left + b.width / 2 - caseBox.left - c.offsetWidth / 2}px`
    }
    const rd = this.#bookcase.querySelector<HTMLElement>('.reading-zone-hint')!
    Object.assign(rd.style, { left: `${back.left - caseBox.left}px`, width: `${endBox.left - back.left}px` })
  }

  // Dragging between sections ------------------------------------------------

  #bindDrag(): void {
    const LONG_PRESS = 350
    this.#list.addEventListener('pointerdown', (e) => {
      this.#suppressClick = false // a fresh press: clicks count again
      if (!this.#owner || e.button !== 0 || this.#drag) return
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.spine')
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const touch = e.pointerType !== 'mouse'
      this.#drag = { id: btn.dataset.id!, btn, pointerId: e.pointerId, touch, startX: e.clientX, startY: e.clientY, x: e.clientX, active: false, offX: e.clientX - r.left, offY: e.clientY - r.top }
      if (touch) this.#drag.timer = window.setTimeout(() => this.#startDrag(), LONG_PRESS)
    })
    window.addEventListener('pointermove', (e) => {
      const d = this.#drag
      if (!d || e.pointerId !== d.pointerId) return
      const dist = Math.hypot(e.clientX - d.startX, e.clientY - d.startY)
      if (!d.active) {
        if (!d.touch && dist > 6) this.#startDrag()
        else if (d.touch && dist > 8) return this.#endDrag(false) // a scroll, not a drag
        if (!this.#drag?.active) return
      }
      d.x = e.clientX
      d.moved = Math.max(d.moved ?? 0, dist)
      this.#moveGhost(e.clientX, e.clientY)
      this.#bookcase.dataset.drop = this.#targetFinished(e.clientX) ? 'finished' : 'reading'
    })
    window.addEventListener('pointerup', (e) => {
      if (this.#drag && e.pointerId === this.#drag.pointerId) this.#endDrag(true)
    })
    window.addEventListener('pointercancel', (e) => {
      if (this.#drag && e.pointerId === this.#drag.pointerId) this.#endDrag(false)
    })
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.#drag?.active) {
        e.preventDefault()
        e.stopPropagation()
        this.#endDrag(false)
      }
    }, true)
    // once a touch drag has started, stop the shelf from scrolling under it
    this.#scroller.addEventListener('touchmove', (e) => { if (this.#drag?.active) e.preventDefault() }, { passive: false })
    this.#list.addEventListener('contextmenu', (e) => { if (this.#drag) e.preventDefault() })
  }

  // Spine context menu (owner only) -----------------------------------------

  #bindMenu(): void {
    this.#list.addEventListener('contextmenu', (e) => {
      if (this.#drag || !this.#owner || !this.#onEdit) return // guests get the browser's menu
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.spine')
      if (!btn) return
      e.preventDefault()
      // A keyboard-opened menu has no pointer position: anchor it to the spine.
      const fromPointer = e.clientX !== 0 || e.clientY !== 0
      this.#openMenu(btn, fromPointer ? { x: e.clientX, y: e.clientY } : undefined)
    })
    this.#list.addEventListener('keydown', (e) => {
      if (!((e.key === 'F10' && e.shiftKey) || e.key === 'ContextMenu')) return
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.spine')
      if (!btn || !this.#owner || !this.#onEdit) return
      e.preventDefault()
      this.#openMenu(btn)
    })
  }

  /** Opens the one-item menu ("Edit") next to a spine, or at the pointer. */
  #openMenu(spine: HTMLButtonElement, at?: { x: number; y: number }): void {
    if (!this.#owner || !this.#onEdit) return
    this.closeMenu(false)
    const id = spine.dataset.id!
    const el = document.createElement('div')
    el.className = 'spine-menu'
    el.setAttribute('role', 'menu')
    el.setAttribute('aria-label', spine.getAttribute('aria-label') ?? '')
    const item = document.createElement('button')
    item.type = 'button'
    item.className = 'spine-menu-item'
    item.setAttribute('role', 'menuitem')
    item.textContent = 'Edit'
    el.append(item)
    document.body.append(el)

    // Next to the pointer, or just right of the spine's middle; kept on screen.
    const r = spine.getBoundingClientRect()
    const m = el.getBoundingClientRect()
    const x = at?.x ?? r.right + 4
    const y = at?.y ?? r.top + r.height / 2 - m.height / 2
    el.style.left = `${Math.max(8, Math.min(x, innerWidth - m.width - 8))}px`
    el.style.top = `${Math.max(8, Math.min(y, innerHeight - m.height - 8))}px`

    item.addEventListener('click', () => {
      this.closeMenu(true)
      this.#onEdit?.(id)
    })
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        this.closeMenu(true)
      } else if (e.key === 'Tab') {
        e.preventDefault()
        this.closeMenu(true)
      }
    })
    const outside = (e: PointerEvent) => {
      if (!el.contains(e.target as Node)) this.closeMenu(!(e.target as HTMLElement).closest?.('button, a, input, [tabindex]'))
    }
    const away = () => this.closeMenu(false)
    // Listen after this event finishes, so the opening press doesn't close it.
    const t = window.setTimeout(() => window.addEventListener('pointerdown', outside, true))
    window.addEventListener('resize', away)
    window.addEventListener('blur', away)
    this.#menu = {
      el,
      spine,
      dispose: () => {
        window.clearTimeout(t)
        window.removeEventListener('pointerdown', outside, true)
        window.removeEventListener('resize', away)
        window.removeEventListener('blur', away)
      },
    }
    item.focus()
  }

  /** Closes the spine menu, if open. `restoreFocus` puts focus back on its spine. */
  closeMenu(restoreFocus = true): void {
    const menu = this.#menu
    if (!menu) return
    this.#menu = null
    menu.dispose()
    const hadFocus = menu.el.contains(document.activeElement)
    menu.el.remove()
    if ((restoreFocus || hadFocus) && menu.spine.isConnected) menu.spine.focus()
  }

  #startDrag(): void {
    const d = this.#drag
    if (!d || d.active) return
    window.clearTimeout(d.timer)
    d.active = true
    const r = d.btn.getBoundingClientRect()
    const ghost = d.btn.cloneNode(true) as HTMLElement
    ghost.removeAttribute('id')
    ghost.classList.add('spine-drag-ghost')
    ghost.setAttribute('aria-hidden', 'true')
    Object.assign(ghost.style, { width: `${r.width}px`, height: `${r.height}px` })
    document.body.append(ghost)
    d.ghost = ghost
    d.btn.classList.add('is-drag-source')
    try { d.btn.setPointerCapture(d.pointerId) } catch { /* not capturable */ }
    this.#moveGhost(d.x, d.startY)
    this.#bookcase.dataset.drop = this.#targetFinished(d.x) ? 'finished' : 'reading'
    const tick = () => {
      if (!this.#drag?.active) return
      const s = this.#scroller.getBoundingClientRect()
      const edge = 64
      if (this.#drag.x < s.left + edge) this.#scroller.scrollLeft -= 12
      else if (this.#drag.x > s.right - edge) this.#scroller.scrollLeft += 12
      this.#bookcase.dataset.drop = this.#targetFinished(this.#drag.x) ? 'finished' : 'reading'
      this.#raf = requestAnimationFrame(tick)
    }
    this.#raf = requestAnimationFrame(tick)
  }

  #moveGhost(x: number, y: number): void {
    const d = this.#drag
    if (!d?.ghost) return
    d.ghost.style.left = `${x - d.offX}px`
    d.ghost.style.top = `${y - d.offY}px`
  }

  #targetFinished(x: number): boolean {
    const end = this.#list.querySelector<HTMLElement>('li.bookend')
    if (!end) return false
    const r = end.getBoundingClientRect()
    return x > r.left + r.width / 2
  }

  #endDrag(drop: boolean): void {
    const d = this.#drag
    if (!d) return
    window.clearTimeout(d.timer)
    cancelAnimationFrame(this.#raf)
    this.#drag = null
    delete this.#bookcase.dataset.drop
    if (!d.active) return
    d.ghost?.remove()
    d.btn.classList.remove('is-drag-source')
    // The release that ends (or follows a cancelled) drag must not open the
    // book. Cleared on the next press.
    this.#suppressClick = true
    if (!drop) return
    // Press-and-hold, then lift without moving: the context menu, not a drop.
    if (d.touch && (d.moved ?? 0) < 8) return this.#openMenu(d.btn)
    const toFinished = this.#targetFinished(d.x)
    if (toFinished !== this.#finishedIds.has(d.id)) this.#onMove(d.id, toFinished)
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
