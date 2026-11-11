import { cleanAuthor, MAX_AUTHOR, type Book, type BookChanges, type SpineSettings } from '../storage/manifest'
import { pickTitleInk } from '../spines/contrast'
import { DEFAULT_FONT_ID, fontFor, loadFont, SPINE_FONTS } from '../spines/fonts'
import { spineHeight, spineWidth } from '../spines/geometry'
import { generatePalette, type Pair } from '../spines/palette'
import { renderSpine } from '../spines/spine'
import { fontMeasures } from '../spines/title-fit'
import type { CoverColors } from '../spines/cover-colors'
import { createDialog, esc, openDialog } from '../ui/dialog'

export interface PreviewInput {
  id: string
  title: string
  /** Prefilled author, if any. */
  author?: string | null
  pages: number
  cover: CoverColors | null
  /** e.g. "Book 1 of 3", or empty for a single book. */
  queueLabel: string
  note?: string
}

/** Opens the dialog for a book already on the shelf. */
export interface EditInput {
  id: string
  title: string
  author?: string | null
  cover: CoverColors | null
  spine: SpineSettings
}

export interface PreviewResult {
  title: string
  author: string | null
  spine: SpineSettings
}

export type BookDialogInput = ({ mode: 'add' } & PreviewInput) | ({ mode: 'edit' } & EditInput)

/** Spine settings for a color pair. `fromCover` records where the colors came from. */
export function spineFor(id: string, pages: number, pair: Pair, fromCover: boolean, font = DEFAULT_FONT_ID): SpineSettings {
  return {
    source: fromCover ? 'cover' : 'trim',
    bg: pair.bg,
    trim: pair.trim,
    ink: pickTitleInk(pair.bg, pair.trim),
    h: spineHeight(id),
    w: spineWidth(id, pages),
    font,
  }
}

/** The same shelf height the shelf uses: clamp(14rem, 42vh, 24rem). */
export function shelfHeightPx(): number {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  return Math.round(Math.min(24 * rem, Math.max(14 * rem, innerHeight * 0.42)))
}

/**
 * What the edit dialog's result changes on `book`, leaving out anything that
 * only looks different (the default font written out, an ink recomputed for
 * unchanged colors), so saving without edits changes nothing.
 */
export function editChanges(book: Book, res: PreviewResult): BookChanges {
  const changes: BookChanges = {}
  if (res.title !== book.title) changes.title = res.title
  if ((res.author ?? null) !== cleanAuthor(book.author)) changes.author = res.author
  const spine: BookChanges['spine'] = {}
  if (res.spine.font !== fontFor(book.spine.font).id) spine.font = res.spine.font
  if (res.spine.bg !== book.spine.bg || res.spine.trim !== book.spine.trim) {
    Object.assign(spine, { bg: res.spine.bg, trim: res.spine.trim, ink: res.spine.ink, source: res.spine.source })
  }
  if (Object.keys(spine).length) changes.spine = spine
  return changes
}

/** The add-book preview. */
export function openPreviewDialog(input: PreviewInput): Promise<PreviewResult | null> {
  return openBookDialog({ mode: 'add', ...input })
}

/**
 * One dialog for adding a book and for editing one on the shelf: title,
 * author, font and colors, with a live spine preview. Resolves with the
 * chosen values, or null if cancelled.
 */
export function openBookDialog(input: BookDialogInput): Promise<PreviewResult | null> {
  const edit = input.mode === 'edit' ? input : null
  const coverPair: Pair | null = input.cover ? { bg: input.cover.dominant, trim: input.cover.accent } : null
  let pair: Pair = edit ? { bg: edit.spine.bg, trim: edit.spine.trim } : coverPair ?? generatePalette()
  let title = input.title
  let author = input.author ?? ''
  let fontId = fontFor(edit?.spine.font).id
  const measures = fontMeasures()
  const isCover = () => !!coverPair && pair.bg === coverPair.bg && pair.trim === coverPair.trim
  const heading = edit ? 'Edit book' : 'Add to your shelf'
  const queueLabel = input.mode === 'add' ? input.queueLabel : ''
  const note = input.mode === 'add' ? input.note : undefined

  const fontOptions = SPINE_FONTS.map((f) => `
    <label class="font-option" style="font-family:${esc(f.stack)};font-weight:${f.weight}">
      <input class="visually-hidden" type="radio" name="font" value="${esc(f.id)}">
      <span>${esc(f.label)}</span>
    </label>`).join('')

  const d = createDialog('preview-title', 'preview-dialog')
  d.innerHTML = `
    <form class="dialog-form" method="dialog" novalidate>
      <div>
        ${queueLabel ? `<p class="fine preview-queue">${esc(queueLabel)}</p>` : ''}
        <h2 class="dialog-title" id="preview-title">${heading}</h2>
        ${note ? `<p class="fine" style="margin:0">${esc(note)}</p>` : ''}
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
          <div class="field">
            <label for="p-author">Author <span class="fine">(optional)</span></label>
            <input class="input" id="p-author" name="author" autocomplete="off" maxlength="${MAX_AUTHOR}">
          </div>
          <fieldset class="field font-field">
            <legend class="label">Font</legend>
            <div class="font-options">${fontOptions}</div>
          </fieldset>
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
        <button type="submit" class="btn btn-primary">${edit ? 'Save' : 'Add to shelf'}</button>
      </div>
    </form>`

  const form = d.querySelector('form')!
  const titleInput = d.querySelector<HTMLInputElement>('#p-title')!
  const titleError = d.querySelector<HTMLElement>('#p-title-error')!
  const authorInput = d.querySelector<HTMLInputElement>('#p-author')!
  const preview = d.querySelector<HTMLElement>('[data-preview]')!
  const bgInput = d.querySelector<HTMLInputElement>('#p-bg')!
  const trimInput = d.querySelector<HTMLInputElement>('#p-trim')!
  const source = d.querySelector<HTMLElement>('.preview-source')!
  const coverBtn = d.querySelector<HTMLButtonElement>('[data-cover]')
  const fontRadios = [...d.querySelectorAll<HTMLInputElement>('input[name="font"]')]
  titleInput.value = title
  authorInput.value = author
  fontRadios.find((r) => r.value === fontId)!.checked = true

  const current = (): SpineSettings => {
    if (input.mode === 'add') return spineFor(input.id, input.pages, pair, isCover(), fontId)
    // Editing never changes the spine's size or trim design.
    return { ...input.spine, source: isCover() ? 'cover' : 'trim', bg: pair.bg, trim: pair.trim, ink: pickTitleInk(pair.bg, pair.trim), font: fontId }
  }

  const render = () => {
    const spine = current()
    bgInput.value = spine.bg.toLowerCase()
    trimInput.value = spine.trim.toLowerCase()
    renderSpine(preview, { id: input.id, title: title || ' ', author, spine, started: false }, shelfHeightPx(), measures.get(spine.font))
    const font = fontFor(spine.font)
    loadFont(font)?.then(() => { measures.reset(font.id); if (d.open) render() })
    source.textContent = isCover() ? 'Colors from the book’s cover.' : coverPair ? 'Custom colors.' : 'This book has no cover, so these colors were picked for it.'
    if (coverBtn) coverBtn.hidden = isCover()
  }

  titleInput.addEventListener('input', () => {
    title = titleInput.value
    if (title.trim()) {
      titleError.textContent = ''
      titleInput.removeAttribute('aria-invalid')
    }
    render()
  })
  authorInput.addEventListener('input', () => { author = authorInput.value; render() })
  for (const r of fontRadios) r.addEventListener('change', () => { if (r.checked) { fontId = r.value; render() } })
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
    result = { title: t, author: cleanAuthor(authorInput.value), spine: current() }
    d.close('ok')
  })

  render()
  return openDialog(d, titleInput).then(() => result)
}
