import AxeBuilder from '@axe-core/playwright'
import { type Page } from '@playwright/test'
import { asOwner, expect, fixture, makeBook, manifestOf, mockPublished, test, turnPages } from './helpers'
import type { Book } from '../../src/storage/manifest'

test.use({ viewport: { width: 1280, height: 800 } })

const BOOKS: Book[] = [
  makeBook({ id: 'b1', title: 'Middlemarch' }),
  makeBook({ id: 'b2', title: 'Emma' }),
  makeBook({ id: 'b3', title: 'Beloved', finishedAt: '2026-02-01T00:00:00Z' }),
]
const FILES = { 'b1.epub': fixture('sample.epub'), 'b2.epub': fixture('sample.epub'), 'b3.epub': fixture('sample.epub') }
const section = (page: Page, title: string) => page.getByRole('button', { name: title }).getAttribute('data-section')
const center = async (page: Page, sel: string) => {
  const b = (await page.locator(sel).first().boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

async function mouseDrag(page: Page, title: string, to: { x: number; y: number }) {
  const from = await center(page, `.spine[aria-label="${title}"]`)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 10, from.y, { steps: 2 })
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await page.mouse.up()
}

test('shows the bookend divider and the carved Finished label to its right', async ({ page }) => {
  await mockPublished(page, manifestOf(BOOKS))
  await page.goto('/')
  await page.locator('li.bookend').waitFor()
  const end = (await page.locator('li.bookend').boundingBox())!
  const beloved = (await page.getByRole('button', { name: 'Beloved' }).boundingBox())!
  const emma = (await page.getByRole('button', { name: 'Emma' }).boundingBox())!
  expect(emma.x + emma.width).toBeLessThanOrEqual(end.x + 1)
  expect(beloved.x).toBeGreaterThanOrEqual(end.x + end.width - 1)
  const label = page.locator('.plank-engraving')
  await expect(label).toHaveText('Finished')
  const lb = (await label.boundingBox())!
  expect(lb.x).toBeGreaterThanOrEqual(end.x + end.width - 1)
  await expect(page.getByRole('button', { name: 'Beloved' })).toHaveAccessibleDescription('Finished')
  await expect(page.getByRole('button', { name: 'Beloved' }).locator('.spine-ribbon')).toHaveCount(0)
})

test('owner drags a book onto the finished side, then back', async ({ page }) => {
  const gh = await asOwner(page, BOOKS, FILES)
  await mouseDrag(page, 'Middlemarch', await center(page, '.finished-spacer'))
  await expect.poll(() => section(page, 'Middlemarch')).toBe('finished')
  await expect.poll(() => gh.pushes).toEqual(['Finish "Middlemarch"'])
  expect(gh.manifest().books.find((b) => b.id === 'b1')!.finishedAt).toBeTruthy()
  await expect(page.getByRole('alert')).toContainText('Middlemarch moved to Finished.')
  await expect(page).not.toHaveURL(/#\/read/) // dropping didn't open the book

  await mouseDrag(page, 'Beloved', await center(page, '.spine[aria-label="Emma"]'))
  await expect.poll(() => section(page, 'Beloved')).toBe('reading')
  await expect.poll(() => gh.pushes.at(-1)).toBe('Move "Beloved" back to reading')
})

test('dropping on the same side or pressing Escape changes nothing', async ({ page }) => {
  const gh = await asOwner(page, BOOKS, FILES)
  await mouseDrag(page, 'Middlemarch', await center(page, '.spine[aria-label="Emma"]'))
  const from = await center(page, '.spine[aria-label="Emma"]')
  const to = await center(page, '.finished-spacer')
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await expect(page.locator('.bookcase')).toHaveAttribute('data-drop', 'finished')
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await page.waitForTimeout(300)
  await expect(page).not.toHaveURL(/#\/read/) // releasing after Escape doesn't open the book
  expect(await section(page, 'Emma')).toBe('reading')
  // the keyboard still opens books right after a drag
  await page.getByRole('button', { name: 'Emma' }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#\/read\/b2$/)
  expect(gh.pushes).toEqual([])
})

test('a plain click still opens the book', async ({ page }) => {
  await asOwner(page, BOOKS, FILES)
  await page.getByRole('button', { name: 'Emma' }).click()
  await expect(page).toHaveURL(/#\/read\/b2$/)
})

test('touch: press and hold, then drag', async ({ browser }) => {
  const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  const { setTheme } = await import('./helpers')
  await setTheme(page, 'day')
  const gh = await asOwner(page, BOOKS, FILES)
  const spine = page.getByRole('button', { name: 'Emma' })
  const from = await center(page, '.spine[aria-label="Emma"]')
  const to = await center(page, '.finished-spacer')
  const ev = (type: string, x: number, y: number) => spine.dispatchEvent(type, { pointerType: 'touch', pointerId: 7, isPrimary: true, button: 0, clientX: x, clientY: y, bubbles: true })
  await ev('pointerdown', from.x, from.y)
  await page.waitForTimeout(450) // long press
  await page.evaluate(([x, y]) => window.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'touch', pointerId: 7, clientX: x, clientY: y })), [to.x, to.y])
  await page.evaluate(([x, y]) => window.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', pointerId: 7, clientX: x, clientY: y })), [to.x, to.y])
  await expect.poll(() => section(page, 'Emma')).toBe('finished')
  await expect.poll(() => gh.pushes).toEqual(['Finish "Emma"'])
  await ctx.close()
})

test('touch: a quick swipe scrolls instead of dragging', async ({ browser }) => {
  const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  const gh = await asOwner(page, BOOKS, FILES)
  const spine = page.getByRole('button', { name: 'Emma' })
  const from = await center(page, '.spine[aria-label="Emma"]')
  await spine.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 9, isPrimary: true, button: 0, clientX: from.x, clientY: from.y })
  await page.evaluate(([x, y]) => window.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'touch', pointerId: 9, clientX: x + 60, clientY: y })), [from.x, from.y])
  await page.waitForTimeout(450)
  await expect(page.locator('.spine-drag-ghost')).toHaveCount(0)
  expect(gh.pushes).toEqual([])
  await ctx.close()
})

test('guests cannot drag books between sections', async ({ page }) => {
  await mockPublished(page, manifestOf(BOOKS))
  await page.goto('/')
  await mouseDrag(page, 'Emma', await center(page, '.finished-spacer'))
  await page.waitForTimeout(300)
  expect(await section(page, 'Emma')).toBe('reading')
  await expect(page.locator('.spine-drag-ghost')).toHaveCount(0)
})

test('the reader offers "Mark finished" as a non-drag alternative (owner only)', async ({ page }) => {
  const gh = await asOwner(page, BOOKS, FILES, '/#/read/b2')
  await expect(page.locator('.reader-stage[data-ready]')).toBeVisible({ timeout: 15000 })
  const btn = page.getByRole('button', { name: 'Mark finished' })
  await expect(btn).toHaveAttribute('aria-pressed', 'false')
  await btn.click()
  await expect(page.getByRole('button', { name: 'Finished' })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => gh.pushes).toEqual(['Finish "Emma"'])
  await page.keyboard.press('Escape')
  await expect.poll(() => section(page, 'Emma')).toBe('finished')
})

test('guests see no finish control in the reader', async ({ page }) => {
  await mockPublished(page, manifestOf(BOOKS), FILES)
  await page.goto('/#/read/b2')
  await expect(page.locator('.reader-stage[data-ready]')).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('button', { name: 'Mark finished' })).toBeHidden()
})

test('an empty finished section still leaves room to drop', async ({ page }) => {
  await mockPublished(page, manifestOf(BOOKS.slice(0, 2)))
  await page.goto('/')
  await page.locator('.finished-spacer').waitFor()
  const spacer = (await page.locator('.finished-spacer').boundingBox())!
  expect(spacer.width).toBeGreaterThanOrEqual(90)
  await expect(page.locator('.plank-engraving')).toBeVisible()
})

for (const theme of ['day', 'night'] as const) {
  test.describe(theme, () => {
    test.use({ theme })
    test(`finished section has no axe violations (${theme})`, async ({ page }) => {
      await mockPublished(page, manifestOf(BOOKS))
      await page.goto('/')
      await page.locator('.spine').first().waitFor()
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([])
    })
  })
}

test('critters and the Finished label keep their place after reading a book and returning', async ({ page }) => {
  // enough books for several critters (after books 3, 9, 15)
  const many = Array.from({ length: 15 }, (_, i) => makeBook({ id: `m${i + 1}`, title: `Title ${i + 1}` }))
  const files = Object.fromEntries(many.map((b) => [`${b.id}.epub`, fixture('sample.epub')]))
  await asOwner(page, many, files) // owner, so reading positions are saved
  await page.locator('.critter').first().waitFor()

  const critterXs = () => page.locator('.critter').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().x)))
  const engravingX = async () => Math.round((await page.locator('.plank-engraving').boundingBox())!.x)
  const before = await critterXs()
  const engBefore = await engravingX()
  expect(before.length).toBeGreaterThanOrEqual(2)
  expect(Math.max(...before) - Math.min(...before)).toBeGreaterThan(100) // genuinely spread out

  await page.locator('.spine').first().click()
  await expect(page).toHaveURL(/#\/read/)
  // Turning a page saves a position: that updates the shelf's store while it is
  // off-screen, which used to re-lay out the decor against zero geometry.
  await turnPages(page, 2)
  await page.goBack()
  await page.locator('.critter').first().waitFor()

  const after = await critterXs()
  for (let i = 0; i < before.length; i++) expect(Math.abs(after[i] - before[i]), `critter ${i}`).toBeLessThan(3)
  expect(Math.abs((await engravingX()) - engBefore)).toBeLessThan(3)
  expect(Math.max(...after) - Math.min(...after)).toBeGreaterThan(100) // not bunched into the corner
})
