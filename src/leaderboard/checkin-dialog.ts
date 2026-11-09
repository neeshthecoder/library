/**
 * The reading leaderboard check-in, opened from the acorns on the bookcase.
 * One <dialog> whose content is swapped per step:
 *
 *   initial → "Feature Coming Soon!"          (any letter but A or M)
 *   initial → book → page → board              (A or M)
 *   initial → book → board                     ("Just show the board")
 *
 * Escape closes it at any step. Text from the store is only ever set with
 * textContent.
 */

import { createDialog, openDialog } from '../ui/dialog'
import { shelfSections, type Book } from '../storage/manifest'
import { MAX_PAGES } from '../../worker/leaderboard/validate'
import { getBoard, saveCheckIn, LeaderboardError } from './api'
import { pickNudge, rankBoard, TIE_LINE, type Board, type Reader } from './board'
import './leaderboard.css'

export interface CheckInDeps {
  getBoard: () => Promise<Board>
  saveCheckIn: typeof saveCheckIn
}

const defaults: CheckInDeps = { getBoard: () => getBoard(), saveCheckIn: (r, c) => saveCheckIn(r, c) }

/** Builds an element with optional class and text (never HTML). */
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

function button(label: string, cls: string, type: 'button' | 'submit' = 'button'): HTMLButtonElement {
  const b = el('button', cls, label)
  b.type = type
  return b
}

const errorMessage = (e: unknown) => (e instanceof LeaderboardError ? e.message : 'Something went wrong. Try again.')

export async function openCheckIn(books: readonly Book[], deps: CheckInDeps = defaults): Promise<void> {
  const d = createDialog('lb-title', 'leaderboard-dialog')
  // Load the standings up front so the book step can preselect your last book.
  let boardPromise: Promise<Board> | null = null
  const loadBoard = () => (boardPromise ??= deps.getBoard().catch((e: unknown) => {
    boardPromise = null
    throw e
  }))

  const show = (...children: Node[]) => d.replaceChildren(...children)

  const title = (text: string) => {
    const h = el('h2', 'dialog-title', text)
    h.id = 'lb-title'
    return h
  }

  const actions = (...buttons: HTMLButtonElement[]) => {
    const div = el('div', 'dialog-actions')
    div.append(...buttons)
    return div
  }

  const cancel = (label = 'Cancel') => {
    const b = button(label, 'btn btn-secondary')
    b.addEventListener('click', () => d.close('cancel'))
    return b
  }

  function stepInitial(): HTMLElement {
    const form = el('form', 'dialog-form')
    form.noValidate = true
    const field = el('div', 'field')
    const label = el('label', '', 'Your initial')
    label.htmlFor = 'lb-initial'
    const input = el('input', 'input lb-initial')
    Object.assign(input, { id: 'lb-initial', maxLength: 1, autocomplete: 'off', spellcheck: false })
    input.setAttribute('autocapitalize', 'characters')
    field.append(label, input)
    const err = el('p', 'field-error')
    err.setAttribute('role', 'alert')
    form.append(title('Who’s checking in?'), field, err, actions(cancel(), button('Next', 'btn btn-primary', 'submit')))
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      const v = input.value.trim().toUpperCase()
      if (!/^[A-Z]$/.test(v)) {
        err.textContent = 'Type one letter.'
        return
      }
      if (v === 'A' || v === 'M') stepBook(v)
      else comingSoon()
    })
    show(form)
    input.focus()
    return input
  }

  function comingSoon(): void {
    const close = cancel('Close')
    show(title('Feature Coming Soon!'), actions(close))
    close.focus()
  }

  function stepBook(reader: Reader): void {
    void loadBoard().catch(() => {}) // warm up; failures surface on the board step
    const form = el('form', 'dialog-form')
    form.noValidate = true
    const field = el('div', 'field')
    const label = el('label', '', 'Which book?')
    label.htmlFor = 'lb-book'
    const select = el('select', 'input lb-select')
    select.id = 'lb-book'
    select.append(new Option('Choose a book', ''))
    const { reading, finished } = shelfSections(books)
    for (const b of reading) select.append(new Option(b.title, b.id))
    if (finished.length) {
      const group = el('optgroup')
      group.label = 'Finished'
      for (const b of finished) group.append(new Option(b.title, b.id))
      select.append(group)
    }
    field.append(label, select)
    const err = el('p', 'field-error')
    err.setAttribute('role', 'alert')
    const peek = button('Just show the board', 'link-btn lb-peek')
    peek.addEventListener('click', () => void stepBoard(null))
    form.append(title(`Hi, ${reader}`), field, peek, err, actions(cancel(), button('Next', 'btn btn-primary', 'submit')))
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      const book = books.find((b) => b.id === select.value)
      if (!book) {
        err.textContent = 'Choose a book.'
        return
      }
      stepPage(reader, book)
    })
    show(form)
    select.focus()
    loadBoard().then(
      (board) => {
        const last = board[reader]?.bookId
        if (last && select.isConnected && !select.value && books.some((b) => b.id === last)) select.value = last
      },
      () => {},
    )
  }

  function stepPage(reader: Reader, book: Book, prior?: { page: string; pages: string; error: string }): void {
    const form = el('form', 'dialog-form')
    form.noValidate = true
    const row = el('div', 'lb-pages')
    const pageField = el('div', 'field')
    const pageLabel = el('label', '', 'Last page read')
    pageLabel.htmlFor = 'lb-page'
    const page = el('input', 'input')
    Object.assign(page, { id: 'lb-page', inputMode: 'numeric', autocomplete: 'off', value: prior?.page ?? '' })
    pageField.append(pageLabel, page)
    const totalField = el('div', 'field')
    const totalLabel = el('label', '', 'of')
    totalLabel.htmlFor = 'lb-total'
    const total = el('input', 'input')
    Object.assign(total, { id: 'lb-total', inputMode: 'numeric', autocomplete: 'off', value: prior?.pages ?? String(book.length.pages || '') })
    totalField.append(totalLabel, total)
    row.append(pageField, totalField)
    const err = el('p', 'field-error', prior?.error ?? '')
    err.setAttribute('role', 'alert')
    const save = button('Save', 'btn btn-primary', 'submit')
    form.append(title(book.title), row, err, actions(cancel(), save))
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const pages = /^\d+$/.test(total.value.trim()) ? Number(total.value.trim()) : NaN
      const p = /^\d+$/.test(page.value.trim()) ? Number(page.value.trim()) : NaN
      if (!(pages >= 1 && pages <= MAX_PAGES)) {
        err.textContent = `The total must be a whole number from 1 to ${MAX_PAGES}.`
        return
      }
      if (!(p >= 0)) {
        err.textContent = 'Enter the last page you read as a whole number.'
        return
      }
      if (p > pages) {
        err.textContent = `The page must be at most ${pages}.`
        return
      }
      save.disabled = true
      save.textContent = 'Saving…'
      err.textContent = ''
      try {
        const board = await deps.saveCheckIn(reader, { bookId: book.id, page: p, pages })
        boardPromise = Promise.resolve(board)
        void stepBoard(board)
      } catch (e2) {
        if (!form.isConnected) return
        save.disabled = false
        save.textContent = 'Save'
        err.textContent = errorMessage(e2)
      }
    })
    show(form)
    ;(prior ? save : page).focus()
  }

  async function stepBoard(board: Board | null): Promise<void> {
    if (!board) {
      show(title('Leaderboard'), el('p', 'dialog-body', 'Loading…'))
      try {
        board = await loadBoard()
      } catch (e) {
        const retry = button('Try again', 'btn btn-primary')
        retry.addEventListener('click', () => void stepBoard(null))
        const err = el('p', 'field-error', errorMessage(e))
        err.setAttribute('role', 'alert')
        show(title('Leaderboard'), err, actions(cancel('Close'), retry))
        retry.focus()
        return
      }
      if (!d.open) return
    }
    const { rows, behind, tie } = rankBoard(board)
    const list = el('ol', 'lb-board')
    for (const row of rows) {
      const li = el('li', 'lb-row')
      li.dataset.reader = row.reader
      const head = el('div', 'lb-row-head')
      head.append(el('span', 'lb-reader', row.reader), el('span', 'lb-percent', row.record ? `${Math.round(row.percent)}%` : '—'))
      const detail = el('p', 'fine lb-detail', row.record ? `${row.record.title} · page ${row.record.page} of ${row.record.pages}` : 'Not started')
      const bar = el('div', 'lb-bar')
      bar.setAttribute('aria-hidden', 'true')
      const fill = el('div', 'lb-bar-fill')
      fill.style.width = `${Math.max(0, Math.min(100, row.percent))}%`
      bar.append(fill)
      li.append(head, detail, bar)
      if (row.reader === behind) li.append(el('p', 'lb-nudge', pickNudge()))
      list.append(li)
    }
    const close = cancel('Close')
    show(title('Leaderboard'), ...(tie ? [el('p', 'lb-nudge lb-tie', TIE_LINE)] : []), list, actions(close))
    close.focus()
  }

  const initial = stepInitial()
  await openDialog(d, initial)
}
