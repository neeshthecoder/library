import { expect, test, type Page } from '@playwright/test'
import { FakeGitHub, fillConnect, fixture, makeBook, manifestOf, mockPublished, turnPages } from './helpers'
import type { Manifest } from '../../src/storage/manifest'

test.use({ viewport: { width: 1280, height: 800 } })

const PDF = makeBook({ id: 'p1', title: 'A Sample PDF', format: 'pdf', length: { pages: 9, estimated: false } })
const EPUB = makeBook({ id: 'e1', title: 'Middlemarch', format: 'epub' })
const FILES = { 'p1.pdf': fixture('sample.pdf'), 'e1.epub': fixture('sample.epub') }
const progress = (page: Page) => page.locator('.reader-progress')
const ready = (page: Page) => expect(page.locator('.reader-stage[data-ready]')).toBeVisible({ timeout: 15000 })

test('saves the position on every page turn and reopens there after closing the tab', async ({ context }) => {
  const page = await context.newPage()
  await mockPublished(page, manifestOf([PDF]), FILES)
  await page.goto('/#/read/p1')
  await ready(page)
  await turnPages(page, 3)
  await expect(progress(page)).toHaveText('6–7 of 9')
  await page.close() // closed immediately, no chance to "leave the reader"
  const again = await context.newPage()
  await mockPublished(again, manifestOf([PDF]), FILES)
  await again.goto('/#/read/p1')
  await ready(again)
  await expect(progress(again)).toHaveText('6–7 of 9')
})

test('EPUB reopens at the same location', async ({ context }) => {
  const page = await context.newPage()
  await mockPublished(page, manifestOf([EPUB]), FILES)
  await page.goto('/#/read/e1')
  await ready(page)
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight')
  await expect.poll(() => progress(page).textContent()).not.toBe('0%')
  // wait for queued page turns to finish: the label must hold steady
  let label = ''
  await expect.poll(async () => {
    const a = await progress(page).textContent()
    await page.waitForTimeout(400)
    const b = await progress(page).textContent()
    label = b ?? ''
    return a === b
  }).toBe(true)
  await page.close()
  const again = await context.newPage()
  await mockPublished(again, manifestOf([EPUB]), FILES)
  await again.goto('/#/read/e1')
  await ready(again)
  await expect(progress(again)).toHaveText(label!)
})

test('first open starts at the beginning and leaves no ribbon', async ({ page }) => {
  await mockPublished(page, manifestOf([PDF]), FILES)
  await page.goto('/#/read/p1')
  await ready(page)
  await expect(progress(page)).toHaveText('1 of 9')
  await page.keyboard.press('Escape')
  await expect(page.locator('.spine .spine-ribbon')).toHaveCount(0)
})

test('reading one page shows the ribbon on return', async ({ page }) => {
  await mockPublished(page, manifestOf([PDF]), FILES)
  await page.goto('/')
  await page.getByRole('button', { name: 'A Sample PDF' }).click()
  await ready(page)
  await page.keyboard.press('ArrowRight')
  await expect(progress(page)).toHaveText('2–3 of 9')
  await page.keyboard.press('Escape')
  await expect(page.locator('.spine .spine-ribbon')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'A Sample PDF' })).toHaveAccessibleDescription(/In progress, 2–3 of 9/)
})

test('falls back to the fraction when a saved CFI no longer resolves', async ({ page }) => {
  const book = { ...EPUB, position: { locator: 'epubcfi(/6/999!/4/2/1:0)', fraction: 0.5, label: '50%', updatedAt: '2026-01-02T00:00:00Z' } }
  await mockPublished(page, manifestOf([book]), FILES)
  await page.goto('/#/read/e1')
  await ready(page)
  const pct = Number((await progress(page).textContent())!.replace('%', ''))
  expect(pct).toBeGreaterThan(30)
  expect(pct).toBeLessThan(70)
})

test('continues on another device after syncing', async ({ browser }) => {
  const gh = new FakeGitHub(manifestOf([PDF]))
  const published = () => gh.manifest() as Manifest

  async function device() {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await ctx.newPage()
    await gh.install(page)
    await mockPublished(page, published, FILES)
    await page.goto('/')
    await page.getByRole('button', { name: 'Library settings' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Connect' }).click()
    await fillConnect(page)
    return { ctx, page }
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
