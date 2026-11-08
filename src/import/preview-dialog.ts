import { TRIM_DESIGNS, type SpineSettings, type TrimDesign } from '../storage/manifest'
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

export type SourceChoice = 'cover' | TrimDesign
export const DESIGN_LABEL: Record<SourceChoice, string> = { cover: 'From cover', frame: 'Frame', medallion: 'Medallion', arch: 'Arch' }

/** Builds spine settings for a source choice. */
export function spineFor(id: string, pages: number, choice: SourceChoice, cover: CoverColors | null, trimPair: Pair): SpineSettings {
  if (choice === 'cover' && cover) {
    return { source: 'cover', bg: cover.dominant, trim: cover.accent, ink: pickTitleInk(cover.dominant, cover.accent), h: spineHeight(id), w: spineWidth(id, pages) }
  }
  const design = choice === 'cover' ? 'frame' : choice
  return { source: 'trim', design, bg: trimPair.bg, trim: trimPair.trim, ink: pickTitleInk(trimPair.bg, trimPair.trim), h: spineHeight(id), w: spineWidth(id, pages, design) }
}

/** The same shelf height the shelf uses: clamp(14rem, 42vh, 24rem). */
export function shelfHeightPx(): number {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  return Math.round(Math.min(24 * rem, Math.max(14 * rem, innerHeight * 0.42)))
}

const randomDesign = (): TrimDesign => TRIM_DESIGNS[Math.floor(Math.random() * TRIM_DESIGNS.length)]

export function openPreviewDialog(input: PreviewInput): Promise<PreviewResult | null> {
  const choices: SourceChoice[] = input.cover ? ['cover', ...TRIM_DESIGNS] : [...TRIM_DESIGNS]
  let choice: SourceChoice = input.cover ? 'cover' : randomDesign()
  let pair = generatePalette()
  let title = input.title
  const measure = canvasMeasure()

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
          <div class="field">
            <span class="label" id="p-source-label">Spine</span>
            <div class="segmented" role="tablist" aria-labelledby="p-source-label">
              <span class="segmented-indicator" aria-hidden="true"></span>
              ${choices.map((c) => `<button type="button" role="tab" id="tab-${c}" data-choice="${c}" aria-controls="p-trim-panel">${DESIGN_LABEL[c]}</button>`).join('')}
            </div>
          </div>
          <div class="preview-colors" id="p-trim-panel" role="tabpanel">
            <div class="color-field"><label for="p-bg">Background</label><input class="color-input" type="color" id="p-bg"></div>
            <div class="color-field"><label for="p-trim">Trim</label><input class="color-input" type="color" id="p-trim"></div>
            <button type="button" class="btn btn-secondary btn-small" data-shuffle>Shuffle colors</button>
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
  const stage = d.querySelector<HTMLElement>('.preview-stage')!
  const tabs = Array.from(d.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
  const panel = d.querySelector<HTMLElement>('#p-trim-panel')!
  const bgInput = d.querySelector<HTMLInputElement>('#p-bg')!
  const trimInput = d.querySelector<HTMLInputElement>('#p-trim')!
  titleInput.value = title

  const current = () => spineFor(input.id, input.pages, choice, input.cover, pair)

  const indicator = d.querySelector<HTMLElement>('.segmented-indicator')!
  const moveIndicator = () => {
    const t = tabs.find((x) => x.dataset.choice === choice)
    if (!t || !t.offsetWidth) return
    indicator.style.width = `${t.offsetWidth}px`
    indicator.style.height = `${t.offsetHeight}px`
    indicator.style.transform = `translate(${t.offsetLeft}px, ${t.offsetTop}px)`
  }
  new ResizeObserver(moveIndicator).observe(d.querySelector('.segmented')!)

  const render = () => {
    const spine = current()
    tabs.forEach((t) => {
      const sel = t.dataset.choice === choice
      t.setAttribute('aria-selected', String(sel))
      t.tabIndex = sel ? 0 : -1
    })
    moveIndicator()
    panel.hidden = choice === 'cover'
    panel.setAttribute('aria-labelledby', `tab-${choice}`)
    bgInput.value = spine.bg.toLowerCase()
    trimInput.value = spine.trim.toLowerCase()
    renderSpine(preview, { id: input.id, title: title || ' ', spine, started: false }, shelfHeightPx(), measure)
    stage.setAttribute('aria-label', `Spine preview: ${DESIGN_LABEL[choice]}`)
  }

  const select = (c: SourceChoice, focus = false) => {
    choice = c
    render()
    if (focus) tabs.find((t) => t.dataset.choice === c)?.focus()
  }

  tabs.forEach((t) => t.addEventListener('click', () => select(t.dataset.choice as SourceChoice)))
  d.querySelector('[role="tablist"]')!.addEventListener('keydown', (e) => {
    const ke = e as KeyboardEvent
    const i = choices.indexOf(choice)
    let n = i
    if (ke.key === 'ArrowRight' || ke.key === 'ArrowDown') n = (i + 1) % choices.length
    else if (ke.key === 'ArrowLeft' || ke.key === 'ArrowUp') n = (i - 1 + choices.length) % choices.length
    else if (ke.key === 'Home') n = 0
    else if (ke.key === 'End') n = choices.length - 1
    else return
    ke.preventDefault()
    select(choices[n], true)
  })
  titleInput.addEventListener('input', () => {
    title = titleInput.value
    if (title.trim()) titleError.textContent = ''
    render()
  })
  bgInput.addEventListener('input', () => { pair = { ...pair, bg: bgInput.value }; render() })
  trimInput.addEventListener('input', () => { pair = { ...pair, trim: trimInput.value }; render() })
  d.querySelector('[data-shuffle]')!.addEventListener('click', () => { pair = generatePalette(); render() })

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
