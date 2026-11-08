import type { SpineSettings } from '../storage/manifest'
import { pickTitleInk } from '../spines/contrast'
import { spineHeight, spineWidth } from '../spines/geometry'
import { generatePalette, type Pair } from '../spines/palette'
import { renderSpine } from '../spines/spine'
import { canvasMeasure } from '../spines/title-fit'
import type { CoverColors } from '../spines/cover-colors'
import { createDialog, esc, openDialog } from '../ui/dialog'

export interface PreviewInput {
  id: string
  title: string
  pages: number
  cover: CoverColors | null
  /** e.g. "Book 1 of 3", or empty for a single book. */
  queueLabel: string
  note?: string
}

export interface PreviewResult {
  title: string
  spine: SpineSettings
}

/** Spine settings for a color pair. `fromCover` records where the colors came from. */
export function spineFor(id: string, pages: number, pair: Pair, fromCover: boolean): SpineSettings {
  return {
    source: fromCover ? 'cover' : 'trim',
    bg: pair.bg,
    trim: pair.trim,
    ink: pickTitleInk(pair.bg, pair.trim),
    h: spineHeight(id),
    w: spineWidth(id, pages),
  }
}

/** The same shelf height the shelf uses: clamp(14rem, 42vh, 24rem). */
export function shelfHeightPx(): number {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  return Math.round(Math.min(24 * rem, Math.max(14 * rem, innerHeight * 0.42)))
}

export function openPreviewDialog(input: PreviewInput): Promise<PreviewResult | null> {
  const coverPair: Pair | null = input.cover ? { bg: input.cover.dominant, trim: input.cover.accent } : null
  let pair: Pair = coverPair ?? generatePalette()
  let title = input.title
  const measure = canvasMeasure()
  const isCover = () => !!coverPair && pair.bg === coverPair.bg && pair.trim === coverPair.trim

  const d = createDialog('preview-title', 'preview-dialog')
  d.innerHTML = `
    <form class="dialog-form" method="dialog" novalidate>
      <div>
        ${input.queueLabel ? `<p class="fine preview-queue">${esc(input.queueLabel)}</p>` : ''}
        <h2 class="dialog-title" id="preview-title">Add to your shelf</h2>
        ${input.note ? `<p class="fine" style="margin:0">${esc(input.note)}</p>` : ''}
      </div>
      <div class="preview-grid">
        <div class="preview-stage" aria-label="Spine preview" role="img">
          <div class="preview-stage-shelf"><div class="spine" data-preview></div></div>
        </div>
        <div class="preview-controls">
          <div class="field">
            <label for="p-title">Title</label>
            <input class="input" id="p-title" name="title" autocomplete="off" required aria-describedby="p-title-error">
            <p class="field-error" id="p-title-error" aria-live="polite"></p>
          </div>
          <div class="preview-colors">
            <div class="color-field"><label for="p-bg">Background</label><input class="color-input" type="color" id="p-bg"></div>
            <div class="color-field"><label for="p-trim">Bands</label><input class="color-input" type="color" id="p-trim"></div>
            <div class="preview-color-actions">
              <button type="button" class="btn btn-secondary btn-small" data-shuffle>Shuffle colors</button>
              ${coverPair ? '<button type="button" class="btn btn-secondary btn-small" data-cover>Use cover colors</button>' : ''}
            </div>
            <p class="fine preview-source" aria-live="polite"></p>
          </div>
        </div>
      </div>
      <div class="dialog-actions">
        <button type="button" class="btn btn-secondary" data-cancel>Cancel</button>
        <button type="submit" class="btn btn-primary">Add to shelf</button>
      </div>
    </form>`

  const form = d.querySelector('form')!
  const titleInput = d.querySelector<HTMLInputElement>('#p-title')!
  const titleError = d.querySelector<HTMLElement>('#p-title-error')!
  const preview = d.querySelector<HTMLElement>('[data-preview]')!
  const bgInput = d.querySelector<HTMLInputElement>('#p-bg')!
  const trimInput = d.querySelector<HTMLInputElement>('#p-trim')!
  const source = d.querySelector<HTMLElement>('.preview-source')!
  const coverBtn = d.querySelector<HTMLButtonElement>('[data-cover]')
  titleInput.value = title

  const current = () => spineFor(input.id, input.pages, pair, isCover())

  const render = () => {
    const spine = current()
    bgInput.value = spine.bg.toLowerCase()
    trimInput.value = spine.trim.toLowerCase()
    renderSpine(preview, { id: input.id, title: title || ' ', spine, started: false }, shelfHeightPx(), measure)
    source.textContent = isCover() ? 'Colors from the book’s cover.' : coverPair ? 'Custom colors.' : 'This book has no cover, so these colors were picked for it.'
    if (coverBtn) coverBtn.hidden = isCover()
  }

  titleInput.addEventListener('input', () => {
    title = titleInput.value
    if (title.trim()) titleError.textContent = ''
    render()
  })
  bgInput.addEventListener('input', () => { pair = { ...pair, bg: bgInput.value }; render() })
  trimInput.addEventListener('input', () => { pair = { ...pair, trim: trimInput.value }; render() })
  d.querySelector('[data-shuffle]')!.addEventListener('click', () => { pair = generatePalette(); render() })
  coverBtn?.addEventListener('click', () => { if (coverPair) pair = { ...coverPair }; render() })

  let result: PreviewResult | null = null
  d.querySelector('[data-cancel]')!.addEventListener('click', () => d.close('cancel'))
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const t = titleInput.value.replace(/\s+/g, ' ').trim()
    if (!t) {
      titleError.textContent = 'Add a title.'
      titleInput.setAttribute('aria-invalid', 'true')
      titleInput.focus()
      return
    }
    result = { title: t, spine: current() }
    d.close('ok')
  })

  render()
  return openDialog(d, titleInput).then(() => result)
}
