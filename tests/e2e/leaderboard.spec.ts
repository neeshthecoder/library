import type { Page, Route } from '@playwright/test'
import { expect, makeBook, manifestOf, mockPublished, test } from './helpers'
import { LEADERBOARD_TEST_URL } from './leaderboard-url'
import type { Board, ReaderRecord } from '../../worker/leaderboard/validate'

// ≥9 books, so the first acorn pair (over book 9) is on the shelf.
const BOOKS = Array.from({ length: 12 }, (_, i) =>
  makeBook({
    id: `l${String(i + 1).padStart(2, '0')}`,
    title: i === 0 ? 'The Pelican Brief' : `Title ${i + 1}`,
    length: { pages: i === 0 ? 346 : 200, estimated: true },
  }),
)
const PELICAN = BOOKS[0]

const rec = (over: Partial<ReaderRecord>): ReaderRecord => ({
  bookId: BOOKS[1].id, title: BOOKS[1].title, page: 124, pages: 200, percent: 62, updatedAt: '2026-11-08T00:00:00Z', ...over,
})

/** An in-memory stand-in for worker/leaderboard. */
class FakeStore {
  board: Board = { A: null, M: null }
  puts: { reader: string; body: unknown }[] = []
  offline = false

  async install(page: Page) {
    await page.route(`${LEADERBOARD_TEST_URL}/**`, (route) => this.#handle(route))
  }

  #handle(route: Route) {
    const req = route.request()
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, PUT, OPTIONS', 'access-control-allow-headers': 'content-type' }
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (this.offline) return route.abort('internetdisconnected')
    const path = new URL(req.url()).pathname
    if (req.method() === 'PUT') {
      const reader = path.split('/').pop()! as 'A' | 'M'
      const body = req.postDataJSON() as { bookId: string; page: number; pages: number }
      this.puts.push({ reader, body })
      const book = BOOKS.find((b) => b.id === body.bookId)!
      this.board[reader] = rec({ ...body, title: book.title, percent: Math.round((body.page / body.pages) * 1000) / 10 })
    }
    return route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(this.board) })
  }
}

async function open(page: Page, store = new FakeStore(), books = BOOKS) {
  await mockPublished(page, manifestOf(books))
  await store.install(page)
  await page.goto('/')
  const acorns = page.getByRole('button', { name: 'Acorns' })
  await acorns.waitFor()
  return { store, acorns, dialog: page.getByRole('dialog') }
}

async function enterInitial(page: Page, letter: string) {
  await page.getByLabel('Your initial').fill(letter)
  await page.getByRole('button', { name: 'Next' }).click()
}

test('the first acorn pair is the only leaderboard button', async ({ page }) => {
  const many = Array.from({ length: 45 }, (_, i) => makeBook({ id: `m${String(i + 1).padStart(2, '0')}` }))
  await open(page, new FakeStore(), many)
  await expect(page.locator('[data-critter="acorns"]')).toHaveCount(2)
  await expect(page.locator('.critter-leaderboard')).toHaveCount(1)
  await expect(page.locator('[data-critter="acorns"]').nth(1)).toHaveAttribute('aria-hidden', 'true')
})

test('an unknown initial says coming soon and closes back to the acorns', async ({ page }) => {
  const { acorns, dialog } = await open(page)
  await acorns.focus()
  await page.keyboard.press('Enter')
  await enterInitial(page, 'q')
  await expect(dialog.getByRole('heading', { name: 'Feature Coming Soon!' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('button', { name: 'Acorns' })).toBeFocused()
})

test('M checks in and sees the board with a nudge for whoever is behind', async ({ page }) => {
  const store = new FakeStore()
  store.board.A = rec({ percent: 62 })
  const { acorns, dialog } = await open(page, store)
  await acorns.click()
  await enterInitial(page, 'm')
  await expect(dialog.getByRole('heading', { name: 'Hi, M' })).toBeVisible()
  await page.getByLabel('Which book?').selectOption({ label: 'The Pelican Brief' })
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByLabel('of')).toHaveValue('346')
  await page.getByLabel('Last page read').fill('173')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(dialog.getByRole('heading', { name: 'Leaderboard' })).toBeVisible()
  expect(store.puts).toEqual([{ reader: 'M', body: { bookId: PELICAN.id, page: 173, pages: 346 } }])
  const rows = dialog.locator('.lb-row')
  await expect(rows.nth(0)).toHaveAttribute('data-reader', 'A')
  await expect(rows.nth(1)).toHaveAttribute('data-reader', 'M')
  await expect(rows.nth(1)).toContainText('50%')
  await expect(rows.nth(1)).toContainText('The Pelican Brief · page 173 of 346')
  await expect(rows.nth(1).locator('.lb-nudge')).toHaveCount(1)
  await expect(rows.nth(0).locator('.lb-nudge')).toHaveCount(0)
})

test('a returning reader gets their last book preselected', async ({ page }) => {
  const store = new FakeStore()
  store.board.M = rec({ bookId: PELICAN.id, title: PELICAN.title })
  const { acorns } = await open(page, store)
  await acorns.click()
  await enterInitial(page, 'M')
  await expect(page.getByLabel('Which book?')).toHaveValue(PELICAN.id)
})

test('a page past the end is refused without saving', async ({ page }) => {
  const { store, acorns, dialog } = await open(page)
  await acorns.click()
  await enterInitial(page, 'A')
  await page.getByLabel('Which book?').selectOption(PELICAN.id)
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('Last page read').fill('400')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('The page must be at most 346.')
  expect(store.puts).toEqual([])
})

test('a failed save keeps the entries and can be retried', async ({ page }) => {
  const { store, acorns, dialog } = await open(page)
  await acorns.click()
  await enterInitial(page, 'A')
  await page.getByLabel('Which book?').selectOption(PELICAN.id)
  await page.getByRole('button', { name: 'Next' }).click()
  store.offline = true
  await page.getByLabel('Last page read').fill('100')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Couldn’t reach the leaderboard')
  await expect(page.getByLabel('Last page read')).toHaveValue('100')
  store.offline = false
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(dialog.getByRole('heading', { name: 'Leaderboard' })).toBeVisible()
  expect(store.puts).toHaveLength(1)
})

test('peeking shows the board without saving, and stored titles stay text', async ({ page }) => {
  const store = new FakeStore()
  store.board.A = rec({ title: '<b>Bold</b> & <img src=x onerror=alert(1)>', percent: 50 })
  store.board.M = rec({ percent: 50.4 })
  const { acorns, dialog } = await open(page, store)
  await acorns.click()
  await enterInitial(page, 'A')
  await page.getByRole('button', { name: 'Just show the board' }).click()
  await expect(dialog.getByRole('heading', { name: 'Leaderboard' })).toBeVisible()
  await expect(dialog).toContainText('<b>Bold</b> & <img src=x onerror=alert(1)>')
  await expect(dialog.locator('b, img')).toHaveCount(0)
  // within one point: a single shared tie line, no individual nudge
  await expect(dialog.locator('.lb-tie')).toHaveCount(1)
  await expect(dialog.locator('.lb-row .lb-nudge')).toHaveCount(0)
  expect(store.puts).toEqual([])
})

test('Escape closes at any step without saving', async ({ page }) => {
  const { store, acorns, dialog } = await open(page)
  await acorns.click()
  await enterInitial(page, 'M')
  await page.getByLabel('Which book?').selectOption(PELICAN.id)
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('Last page read').fill('10')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  expect(store.puts).toEqual([])
})
