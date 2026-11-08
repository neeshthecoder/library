import { type BrowserContext, type Page } from '@playwright/test'
import { connect, expect, FakeGitHub, fixture, makeBook, manifestOf, mockPublished, setTheme, test, turnPages } from './helpers'
import type { Book } from '../../src/storage/manifest'

test.use({ viewport: { width: 1280, height: 800 } })

const PDF = makeBook({ id: 'p1', title: 'A Sample PDF', format: 'pdf', length: { pages: 9, estimated: false } })
const EPUB = makeBook({ id: 'e1', title: 'Middlemarch', format: 'epub' })
const FILES = { 'p1.pdf': fixture('sample.pdf'), 'e1.epub': fixture('sample.epub') }
const progress = (page: Page) => page.locator('.reader-progress')
const ready = (page: Page) => expect(page.locator('.reader-stage[data-ready]')).toBeVisible({ timeout: 15000 })

/** A tab in `context` served by the fake repo; signs in unless the context already is. */
async function ownerTab(context: BrowserContext, gh: FakeGitHub, signIn = true) {
  const page = await context.newPage()
  await setTheme(page, 'day')
  await gh.install(page)
  await mockPublished(page, () => gh.manifest(), FILES)
  await page.goto('/')
  if (signIn) await connect(page)
  return page
}

/** Stored reading positions in this browser. */
const storedPositions = (page: Page) => page.evaluate(() => new Promise<number>((resolve) => {
  const req = indexedDB.open('virtual-library')
  req.onsuccess = () => {
    const c = req.result.transaction('positions').objectStore('positions').count()
    c.onsuccess = () => resolve(c.result)
  }
  req.onerror = () => resolve(0)
}))

test.describe('owner', () => {
  test('saves the position on every page turn and reopens there after closing the tab', async ({ context }) => {
    const gh = new FakeGitHub(manifestOf([PDF]))
    const page = await ownerTab(context, gh)
    await page.goto('/#/read/p1')
    await ready(page)
    await turnPages(page, 3)
    await expect(progress(page)).toHaveText('6–7 of 9')
    await page.close() // closed immediately, no chance to "leave the reader"
    const again = await ownerTab(context, gh, false)
    await again.goto('/#/read/p1')
    await ready(again)
    await expect(progress(again)).toHaveText('6–7 of 9')
  })

  test('EPUB reopens at the same location', async ({ context }) => {
    const gh = new FakeGitHub(manifestOf([EPUB]))
    const page = await ownerTab(context, gh)
    await page.goto('/#/read/e1')
    await ready(page)
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight')
    await expect.poll(() => progress(page).textContent()).not.toBe('0%')
    let label = ''
    await expect.poll(async () => {
      const a = await progress(page).textContent()
      await page.waitForTimeout(400)
      const b = await progress(page).textContent()
      label = b ?? ''
      return a === b
    }).toBe(true)
    await page.close()
    const again = await ownerTab(context, gh, false)
    await again.goto('/#/read/e1')
    await ready(again)
    await expect(progress(again)).toHaveText(label)
  })

  test('first open starts at the beginning and leaves no ribbon', async ({ context }) => {
    const page = await ownerTab(context, new FakeGitHub(manifestOf([PDF])))
    await page.goto('/#/read/p1')
    await ready(page)
    await expect(progress(page)).toHaveText('1 of 9')
    await page.keyboard.press('Escape')
    await expect(page.locator('.spine .spine-ribbon')).toHaveCount(0)
  })

  test('reading one page shows the ribbon on return', async ({ context }) => {
    const page = await ownerTab(context, new FakeGitHub(manifestOf([PDF])))
    await page.getByRole('button', { name: 'A Sample PDF' }).click()
    await ready(page)
    await page.keyboard.press('ArrowRight')
    await expect(progress(page)).toHaveText('2–3 of 9')
    await page.keyboard.press('Escape')
    await expect(page.locator('.spine .spine-ribbon')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'A Sample PDF' })).toHaveAccessibleDescription(/In progress, 2–3 of 9/)
  })

  test('falls back to the fraction when a saved CFI no longer resolves', async ({ context }) => {
    const book: Book = { ...EPUB, position: { locator: 'epubcfi(/6/999!/4/2/1:0)', fraction: 0.5, label: '50%', updatedAt: '2026-01-02T00:00:00Z' } }
    const page = await ownerTab(context, new FakeGitHub(manifestOf([book])))
    await page.goto('/#/read/e1')
    await ready(page)
    const pct = Number((await progress(page).textContent())!.replace('%', ''))
    expect(pct).toBeGreaterThan(30)
    expect(pct).toBeLessThan(70)
  })

  test('continues on another device after syncing', async ({ browser }) => {
    const gh = new FakeGitHub(manifestOf([PDF]))
    const device = async () => {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
      return { ctx, page: await ownerTab(ctx, gh) }
    }
    const a = await device()
    await a.page.getByRole('button', { name: 'A Sample PDF' }).click()
    await ready(a.page)
    await turnPages(a.page, 4)
    await expect(progress(a.page)).toHaveText('8–9 of 9')
    expect(gh.pushes).toEqual([]) // no commit per page turn
    await a.page.keyboard.press('Escape')
    await expect.poll(() => gh.pushes).toEqual(['Update reading positions'])
    await a.ctx.close()

    const b = await device()
    await expect(b.page.locator('.spine .spine-ribbon')).toHaveCount(1)
    await b.page.getByRole('button', { name: 'A Sample PDF' }).click()
    await ready(b.page)
    await expect(progress(b.page)).toHaveText('8–9 of 9')
    await b.ctx.close()
  })
})

test.describe('guests', () => {
  const owned: Book = { ...PDF, position: { locator: '6', fraction: 0.6, label: '6–7 of 9', updatedAt: '2026-01-02T00:00:00Z' } }

  test('open at the beginning, keep their place for the tab only, and change nothing', async ({ context }) => {
    const gh = new FakeGitHub(manifestOf([owned]))
    await gh.install(await context.newPage()) // keep api routes ready for any page
    const page = await context.newPage()
    await setTheme(page, 'day')
    await gh.install(page)
    await mockPublished(page, manifestOf([owned]), FILES)
    await page.goto('/')
    await expect(page.locator('.spine .spine-ribbon')).toHaveCount(1) // the owner's bookmark
    await page.getByRole('button', { name: 'A Sample PDF' }).click()
    await ready(page)
    await expect(progress(page)).toHaveText('1 of 9') // not the owner's page 6
    await turnPages(page, 2)
    await expect(progress(page)).toHaveText('4–5 of 9')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'A Sample PDF' }).click()
    await ready(page)
    await expect(progress(page)).toHaveText('4–5 of 9') // same tab remembers
    expect(await storedPositions(page)).toBe(0)
    expect(gh.pushes).toEqual([])
    await page.reload()
    await ready(page)
    await expect(progress(page)).toHaveText('1 of 9') // nothing stored
  })
})
