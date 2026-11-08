import type { PDFDocumentProxy } from 'pdfjs-dist'
import { loadPdfjs, openPdf } from './pdfjs'
import type { BookRenderer, RendererOptions } from './renderer'
import { nextPage, pdfLabel, prevPage, spreadFor, type Mode } from './spread'

const MAX_DPR = 2
const SWIPE_PX = 40

interface Rendered {
  el: HTMLElement
  key: string
}

/** pdf.js renderer: canvases sized to the spread, with a text layer per page. */
export class PdfRenderer implements BookRenderer {
  #o: RendererOptions
  #doc!: PDFDocumentProxy
  #page = 1
  #mode: Mode
  #spread: HTMLElement
  #cache = new Map<number, Rendered>()
  #ro: ResizeObserver
  #token = 0
  #pointer: { x: number; y: number } | null = null

  constructor(o: RendererOptions) {
    this.#o = o
    this.#mode = o.mode
    this.#spread = document.createElement('div')
    this.#spread.className = 'pdf-spread'
    o.container.append(this.#spread)
    this.#ro = new ResizeObserver(() => {
      this.#cache.clear()
      void this.#show()
    })
    o.container.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') this.#pointer = { x: e.clientX, y: e.clientY }
    })
    o.container.addEventListener('pointerup', (e) => {
      const s = this.#pointer
      this.#pointer = null
      if (!s) return
      const dx = e.clientX - s.x, dy = e.clientY - s.y
      if (Math.abs(dx) < SWIPE_PX || Math.abs(dy) > Math.abs(dx)) return
      void (dx < 0 ? this.next() : this.prev())
    })
  }

  get total(): number {
    return this.#doc?.numPages ?? 0
  }

  async open(start: string | null, fraction: number | null): Promise<void> {
    this.#doc = await openPdf(this.#o.blob)
    const n = Number(start)
    this.#page = Number.isFinite(n) && n >= 1 ? Math.min(n, this.total)
      : fraction != null ? Math.max(1, Math.round(fraction * this.total)) : 1
    this.#ro.observe(this.#o.container)
    await this.#show()
  }

  async next(): Promise<boolean> {
    const n = nextPage(this.#page, this.total, this.#mode)
    if (n === null) return false
    this.#page = n
    await this.#show()
    return true
  }

  async prev(): Promise<boolean> {
    const p = prevPage(this.#page, this.total, this.#mode)
    if (p === null) return false
    this.#page = p
    await this.#show()
    return true
  }

  async setMode(mode: Mode): Promise<void> {
    if (mode === this.#mode) return
    this.#mode = mode
    this.#cache.clear()
    await this.#show()
  }

  destroy(): void {
    this.#ro.disconnect()
    this.#cache.clear()
    void this.#doc?.loadingTask.destroy()
    this.#spread.remove()
  }

  #scaleKey(): string {
    const r = this.#o.container.getBoundingClientRect()
    return `${Math.round(r.width)}x${Math.round(r.height)}:${this.#mode}`
  }

  async #renderPage(num: number, perPageWidth: number, height: number): Promise<HTMLElement> {
    const key = this.#scaleKey()
    const hit = this.#cache.get(num)
    if (hit && hit.key === key) return hit.el
    const page = await this.#doc.getPage(num)
    const base = page.getViewport({ scale: 1 })
    const scale = Math.min(perPageWidth / base.width, height / base.height)
    const vp = page.getViewport({ scale })
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1)

    const el = document.createElement('div')
    el.className = 'pdf-page'
    el.style.width = `${Math.floor(vp.width)}px`
    el.style.height = `${Math.floor(vp.height)}px`
    el.style.setProperty('--scale-factor', String(scale))
    el.style.setProperty('--total-scale-factor', String(scale))
    el.dataset.page = String(num)

    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(vp.width * dpr)
    canvas.height = Math.floor(vp.height * dpr)
    canvas.style.width = `${Math.floor(vp.width)}px`
    canvas.style.height = `${Math.floor(vp.height)}px`
    canvas.setAttribute('aria-hidden', 'true')
    el.append(canvas)
    await page.render({ canvas, viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined }).promise

    const text = document.createElement('div')
    text.className = 'textLayer'
    el.append(text)
    const { TextLayer } = await loadPdfjs()
    await new TextLayer({ textContentSource: page.streamTextContent(), container: text, viewport: vp }).render().catch(() => undefined)

    this.#cache.set(num, { el, key })
    if (this.#cache.size > 8) this.#cache.delete(this.#cache.keys().next().value!)
    return el
  }

  async #show(): Promise<void> {
    const token = ++this.#token
    const pages = spreadFor(this.#page, this.total, this.#mode)
    const r = this.#o.container.getBoundingClientRect()
    const cols = this.#mode === 'spread' ? 2 : 1
    const perW = r.width / cols
    const els = await Promise.all(pages.map((p) => this.#renderPage(p, perW, r.height)))
    if (token !== this.#token) return
    this.#spread.dataset.mode = this.#mode
    // a lone first page sits on the right of an open book
    this.#spread.dataset.align = this.#mode === 'spread' && pages.length === 1 && pages[0] === 1 ? 'right' : pages.length === 1 && this.#mode === 'spread' ? 'left' : 'center'
    this.#spread.replaceChildren(...els)
    this.#o.onRelocate({
      locator: String(pages[0]),
      fraction: this.total > 1 ? (pages[0] - 1) / (this.total - 1) : 1,
      label: pdfLabel(pages, this.total),
    })
    // prerender neighbours
    const n = nextPage(this.#page, this.total, this.#mode)
    const p = prevPage(this.#page, this.total, this.#mode)
    const ahead = [n, p].flatMap((x) => (x === null ? [] : spreadFor(x, this.total, this.#mode)))
    for (const num of ahead) void this.#renderPage(num, perW, r.height).catch(() => undefined)
  }
}
