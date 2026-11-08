import type { FoliateView, RelocateDetail } from '@vendor/foliate-js/view.js'
import type { BookRenderer, RendererOptions } from './renderer'
import type { Mode } from './spread'
import { BOOK_CONTENT_CSS } from './book-styles'

/** Adapter around foliate-js's <foliate-view> for EPUB, MOBI and AZW3. */
export class FoliateRenderer implements BookRenderer {
  #o: RendererOptions
  #view!: FoliateView
  #atEnd = false
  #atStart = true

  constructor(o: RendererOptions) {
    this.#o = o
  }

  async open(start: string | null, fraction: number | null): Promise<void> {
    await import('@vendor/foliate-js/view.js')
    const view = document.createElement('foliate-view') as FoliateView
    view.className = 'foliate-view'
    this.#view = view
    this.#o.container.append(view)
    view.addEventListener('relocate', (e) => this.#onRelocate((e as CustomEvent<RelocateDetail>).detail))
    view.addEventListener('load', (e) => {
      const doc = (e as CustomEvent<{ doc: Document }>).detail.doc
      doc.addEventListener('keydown', (ke) => this.#o.onKey(ke))
    })
    await view.open(new File([this.#o.blob], this.#o.name))
    this.#configure(this.#o.mode)
    view.renderer.setStyles?.(BOOK_CONTENT_CSS)

    let opened = false
    if (start) {
      try {
        const resolved = (view as unknown as { resolveNavigation(t: string): { index?: number } | undefined }).resolveNavigation(start)
        const index = resolved?.index
        if (typeof index === 'number' && index >= 0 && index < view.book.sections.length) {
          await view.init({ lastLocation: start })
          opened = true
        }
      } catch { /* fall back to fraction */ }
    }
    if (!opened && fraction != null && fraction > 0) {
      await view.init({ showTextStart: false })
      await view.goToFraction(fraction)
      opened = true
    }
    if (!opened) await view.init({ showTextStart: false })
  }

  #configure(mode: Mode) {
    const r = this.#view.renderer
    r.setAttribute('flow', 'paginated')
    r.setAttribute('max-column-count', mode === 'spread' ? '2' : '1')
    r.setAttribute('max-inline-size', '560px')
    r.setAttribute('gap', '6%')
    r.setAttribute('margin', '32px')
  }

  #onRelocate(d: RelocateDetail): void {
    const fraction = Math.min(1, Math.max(0, d.fraction ?? 0))
    this.#atStart = fraction <= 0
    this.#atEnd = fraction >= 0.9999
    if (!d.cfi) return
    this.#o.onRelocate({ locator: d.cfi, fraction, label: `${Math.round(fraction * 100)}%` })
  }

  async next(): Promise<boolean> {
    if (this.#atEnd) return false
    await this.#view.next()
    return true
  }

  async prev(): Promise<boolean> {
    if (this.#atStart) return false
    await this.#view.prev()
    return true
  }

  async setMode(mode: Mode): Promise<void> {
    this.#configure(mode)
  }

  destroy(): void {
    try {
      this.#view?.close()
    } catch { /* already closed */ }
    this.#view?.remove()
  }
}
