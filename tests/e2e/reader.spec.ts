import AxeBuilder from '@axe-core/playwright'
import { type Page } from '@playwright/test'
import { FakeGitHub, fillConnect, fixture, makeBook, manifestOf, mockPublished, turnPages, expect, setTheme, test } from './helpers'

const BOOKS = [
  makeBook({ id: 'p1', title: 'A Sample PDF', format: 'pdf', length: { pages: 9, estimated: false } }),
  makeBook({ id: 'e1', title: 'Middlemarch', format: 'epub' }),
  makeBook({ id: 'm1', title: 'The Gift of the Magi', format: 'mobi' }),
  makeBook({ id: 'a1', title: 'The Gift of the Magi (KF8)', format: 'azw3' }),
  makeBook({ id: 's1', title: 'Scripted Book', format: 'epub' }),
  makeBook({ id: 'x1', title: 'Missing File', format: 'epub' }),
]
const FILES = {
  'p1.pdf': fixture('sample.pdf'),
  'e1.epub': fixture('sample.epub'),
  'm1.mobi': fixture('magi.mobi'),
  'a1.azw3': fixture('magi.azw3'),
  's1.epub': fixture('script.epub'),
}

async function open(page: Page, id: string) {
  await mockPublished(page, manifestOf(BOOKS), FILES)
  await page.goto(`/#/read/${id}`)
  await expect(page.locator('.reader-stage[data-ready]')).toBeVisible({ timeout: 15000 })
}
const progress = (page: Page) => page.locator('.reader-progress')

test.describe('reader', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('PDF: page 1 alone on the right, then facing pages; selectable text', async ({ page }) => {
    await open(page, 'p1')
    await expect(progress(page)).toHaveText('1 of 9')
    const pages = page.locator('.pdf-page')
    await expect(pages).toHaveCount(1)
    const box = await pages.first().boundingBox()
    expect(box!.x).toBeGreaterThan(1280 / 2 - 40)
    await page.keyboard.press('ArrowRight')
    await expect(progress(page)).toHaveText('2–3 of 9')
    await expect(pages).toHaveCount(2)
    await expect(page.locator('.pdf-page[data-page="2"] .textLayer')).toContainText('Page 2')
    await page.keyboard.press('ArrowLeft')
    await expect(progress(page)).toHaveText('1 of 9')
  })

  test('PDF: boundaries are quiet no-ops', async ({ page }) => {
    await open(page, 'p1')
    await page.keyboard.press('ArrowLeft')
    await expect(progress(page)).toHaveText('1 of 9')
    await turnPages(page, 4)
    await expect(progress(page)).toHaveText('8–9 of 9')
    await page.keyboard.press('ArrowRight')
    await expect(progress(page)).toHaveText('8–9 of 9')
    await expect(page.locator('.app-messages')).toBeEmpty()
  })

  test('edge buttons turn pages and are labelled', async ({ page }) => {
    await open(page, 'p1')
    await page.getByRole('button', { name: 'Next page' }).click()
    await expect(progress(page)).toHaveText('2–3 of 9')
    await page.getByRole('button', { name: 'Previous page' }).click()
    await expect(progress(page)).toHaveText('1 of 9')
  })

  test('switches between spread and single page on resize, keeping the place', async ({ page }) => {
    await open(page, 'p1')
    await turnPages(page, 2)
    await expect(progress(page)).toHaveText('4–5 of 9')
    await page.setViewportSize({ width: 390, height: 800 })
    await expect(progress(page)).toHaveText('4 of 9')
    await expect(page.locator('.pdf-page')).toHaveCount(1)
    await page.setViewportSize({ width: 1280, height: 800 })
    await expect(progress(page)).toHaveText('4–5 of 9')
  })

  for (const [id, label] of [['e1', 'EPUB'], ['m1', 'MOBI'], ['a1', 'AZW3']] as const) {
    test(`${label}: two columns, reflow, page turns`, async ({ page }) => {
      await open(page, id)
      await expect(progress(page)).toHaveText(/^\d+%$/)
      const cols = () => page.locator('foliate-view').evaluate(() => {
        const view = document.querySelector('foliate-view') as unknown as { renderer: { getContents(): { doc: Document }[] } }
        const doc = view.renderer.getContents()[0]?.doc
        return doc ? getComputedStyle(doc.documentElement).columnCount : 'none'
      })
      // two columns side by side in spread mode
      const w = await page.locator('foliate-view').evaluate((el) => el.getBoundingClientRect().width)
      expect(w).toBeGreaterThan(800)
      expect(['2', 'auto']).toContain(await cols())
      const before = await progress(page).textContent()
      await page.keyboard.press('ArrowRight')
      await page.keyboard.press('ArrowRight')
      await expect.poll(() => progress(page).textContent()).not.toBe(before)
      // reflow: the layout switches to one column when narrow
      await page.setViewportSize({ width: 390, height: 800 })
      await expect.poll(async () => (await page.locator('foliate-view').boundingBox())!.width).toBeLessThan(400)
    })
  }

  test('EPUB: arrow keys work with focus inside the book iframe', async ({ page }) => {
    await open(page, 'e1')
    await page.locator('foliate-view').click({ position: { x: 640, y: 300 } })
    const before = await progress(page).textContent()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => progress(page).textContent()).not.toBe(before)
  })

  test('touch swipe turns PDF pages', async ({ browser }) => {
    const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 1280, height: 800 } })
    const page = await ctx.newPage()
    await setTheme(page, 'day')
    await open(page, 'p1')
    const stage = page.locator('.reader-book')
    const b = (await stage.boundingBox())!
    const y = b.y + b.height / 2
    await stage.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: b.x + b.width * 0.6, clientY: y })
    await stage.dispatchEvent('pointerup', { pointerType: 'touch', clientX: b.x + b.width * 0.3, clientY: y })
    await expect(progress(page)).toHaveText('2–3 of 9')
    await stage.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: b.x + b.width * 0.3, clientY: y })
    await stage.dispatchEvent('pointerup', { pointerType: 'touch', clientX: b.x + b.width * 0.6, clientY: y })
    await expect(progress(page)).toHaveText('1 of 9')
    await ctx.close()
  })

  test('Escape returns to the shelf with focus on the book', async ({ page }) => {
    await mockPublished(page, manifestOf(BOOKS), FILES)
    await page.goto('/')
    await page.getByRole('button', { name: 'Middlemarch' }).click()
    await expect(page.locator('.reader-stage[data-ready]')).toBeVisible({ timeout: 15000 })
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'The bookshelf.' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Middlemarch' })).toBeFocused()
  })

  test('missing file shows a plain error with a way back', async ({ page }) => {
    await mockPublished(page, manifestOf(BOOKS), FILES)
    await page.goto('/#/read/x1')
    await expect(page.getByText('This book’s file couldn’t be loaded.')).toBeVisible()
    await page.getByRole('button', { name: 'Back to shelf' }).last().click()
    await expect(page.getByRole('heading', { name: 'The bookshelf.' })).toBeVisible()
  })

  test('scripts inside EPUBs never run @cross', async ({ page }) => {
    await open(page, 's1')
    await expect(page.locator('foliate-view')).toBeVisible()
    await page.waitForTimeout(1000)
    const ran = await page.evaluate(() => (window as unknown as { __epubScriptRan?: boolean }).__epubScriptRan ?? false)
    expect(ran).toBe(false)
    const title = await page.evaluate(() => {
      const view = document.querySelector('foliate-view') as unknown as { renderer: { getContents(): { doc: Document }[] } }
      return view.renderer.getContents()[0]?.doc?.title
    })
    expect(title).not.toBe('SCRIPT RAN')
    await expect(progress(page)).toHaveText(/%$/)
  })

  test('reader chrome has no axe violations', async ({ page }) => {
    await open(page, 'p1')
    const r = await new AxeBuilder({ page }).exclude('.textLayer').analyze()
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([])
  })
})

test.describe('delete', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  async function connected(page: Page) {
    const gh = new FakeGitHub(manifestOf([BOOKS[1]]))
    gh.blobs.set('x', FILES['e1.epub'])
    await gh.install(page)
    await mockPublished(page, manifestOf([BOOKS[1]]), FILES)
    await page.goto('/')
    await page.getByRole('button', { name: 'Library settings' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Connect' }).click()
    await fillConnect(page)
    await page.getByRole('button', { name: 'Middlemarch' }).click()
    await expect(page.locator('.reader-stage[data-ready]')).toBeVisible({ timeout: 15000 })
    return gh
  }

  test('cancel keeps the book open', async ({ page }) => {
    await connected(page)
    await page.getByRole('button', { name: 'Delete book' }).click()
    const d = page.getByRole('alertdialog', { name: 'Delete Middlemarch?' })
    await expect(d).toContainText('This removes the file from your library.')
    await d.getByRole('button', { name: 'Cancel' }).click()
    await expect(d).toBeHidden()
    await page.getByRole('button', { name: 'Delete book' }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('alertdialog')).toBeHidden()
    await expect(page.locator('.reader-stage[data-ready]')).toBeVisible()
  })

  test('confirm removes the book everywhere', async ({ page }) => {
    const gh = await connected(page)
    await page.getByRole('button', { name: 'Delete book' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('heading', { name: 'The bookshelf.' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Middlemarch' })).toHaveCount(0)
    expect(gh.pushes.at(-1)).toBe('Delete "Middlemarch"')
    expect(gh.manifest().books).toEqual([])
  })

  test('asks to connect first on an unconnected device', async ({ page }) => {
    const gh = new FakeGitHub(manifestOf([BOOKS[1]]))
    await gh.install(page)
    await open(page, 'e1')
    await page.getByRole('button', { name: 'Delete book' }).click()
    const d = page.getByRole('dialog', { name: 'Connect your library' })
    await expect(d).toContainText('Connect your library to delete books.')
    await d.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
  })
})
