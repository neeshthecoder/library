import AxeBuilder from '@axe-core/playwright'
import { type Page } from '@playwright/test'
import { asOwner, expect, fixture, makeBook, manifestOf, mockPublished, test } from './helpers'

const BOOKS = [makeBook({ id: 'p1', title: 'A Sample PDF', format: 'pdf', length: { pages: 9, estimated: false } }), makeBook({ id: 'b2', title: 'Emma' })]
const shelf = async (page: Page) => {
  await mockPublished(page, manifestOf(BOOKS), { 'p1.pdf': fixture('sample.pdf') })
  await page.goto('/')
  await page.locator('.spine').first().waitFor()
}
const bg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor)

test('sans text uses Helvetica; spine titles use the headline serif', async ({ page }) => {
  await shelf(page)
  expect(await page.locator('.spine-title').first().evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/^"?Instrument Serif/)
  for (const sel of ['body', '.shelf-footer .link-btn', '.shelf-subtitle']) {
    const ff = await page.locator(sel).first().evaluate((e) => getComputedStyle(e).fontFamily)
    expect(ff, sel).toMatch(/^Helvetica/)
  }
  expect(await page.locator('h1').evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/^"?Instrument Serif/)
})

test('subtitle sits under the headline; footer text is smaller still', async ({ page }) => {
  await shelf(page)
  const sub = page.getByText('Books I am (or should be) reading.')
  await expect(sub).toBeVisible()
  const size = (sel: string) => page.locator(sel).first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize))
  expect(await size('.shelf-subtitle')).toBe(14)
  expect(await size('.shelf-footer .link-btn')).toBe(12)
  expect(await size('.shelf-size')).toBe(12)
  const h1 = (await page.locator('h1').boundingBox())!
  const s = (await sub.boundingBox())!
  expect(s.y).toBeGreaterThan(h1.y + h1.height - 1)
  expect(Math.abs(s.x + s.width / 2 - (h1.x + h1.width / 2))).toBeLessThan(2)
})

test('the drag overlay text is set in Instrument Serif', async ({ page }) => {
  await asOwner(page, BOOKS)
  const dt = await page.evaluateHandle(() => { const d = new DataTransfer(); d.items.add(new File(['x'], 'a.pdf')); return d })
  await page.dispatchEvent('body', 'dragenter', { dataTransfer: dt })
  const text = page.getByText('Drag file here')
  await expect(text).toBeVisible()
  expect(await text.evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/^"?Instrument Serif/)
  expect(await text.evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(40)
})

test('day: paper background, no night sky', async ({ page }) => {
  await shelf(page)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'day')
  expect(await bg(page)).toBe('rgb(248, 246, 241)')
  await expect(page.locator('.night-sky')).toBeHidden()
})

test('the secret period toggle flips day/night and sticks across a reload', async ({ page }) => {
  await shelf(page) // noon → day
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'day')
  await page.locator('.period-toggle').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night')
  await expect(page.locator('.night-sky')).toBeVisible()
  await expect(page.locator('.day-sky')).toBeHidden()
  // the choice survives a reload (read before first paint)
  await page.reload()
  await page.locator('.spine').first().waitFor()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night')
  // and flips back
  await page.locator('.period-toggle').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'day')
})

test.describe('a forced theme ignores the clock', () => {
  test.use({ theme: 'night' }) // clock starts at 22:00

  test('forcing day at night stays day deeper into the night', async ({ page }) => {
    await shelf(page)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night')
    await page.locator('.period-toggle').click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'day')
    // 22:00 → +2h = midnight, which would normally be night; the override holds
    await page.clock.fastForward('02:00:00')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'day')
  })
})

test('day: a sun in the top right and clouds behind the headline', async ({ page }) => {
  await shelf(page)
  const sun = (await page.locator('.sky-sun').boundingBox())!
  const vw = page.viewportSize()!.width
  expect(sun.x).toBeGreaterThan(vw * 0.7)
  expect(sun.y).toBeLessThan(60)
  await expect(page.locator('.sky-cloud')).toHaveCount(5)
  // the headline paints over the clouds
  const h1 = (await page.locator('h1').boundingBox())!
  const top = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('h1, .day-sky')?.tagName, [h1.x + h1.width / 2, h1.y + h1.height / 2])
  expect(top).toBe('H1')
})

test('switches to night at 19:00 while the page is open', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 8, 18, 59, 30) })
  await shelf(page)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'day')
  await page.clock.fastForward('01:00')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night')
  await page.clock.fastForward('12:00:00')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'day')
})

test.describe('night', () => {
  test.use({ theme: 'night' })

  test('navy background, white text, moon and stars at the top', async ({ page }) => {
    await shelf(page)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night')
    expect(await bg(page)).toBe('rgb(15, 23, 47)')
    expect(await page.locator('h1').evaluate((e) => getComputedStyle(e).color)).toBe('rgb(255, 255, 255)')
    await expect(page.locator('.day-sky')).toBeHidden()
    const sky = page.locator('.night-sky')
    await expect(sky).toBeVisible()
    const box = (await sky.boundingBox())!
    expect(box.y).toBeLessThan(5)
    const h1 = (await page.locator('h1').boundingBox())!
    expect(box.y + box.height).toBeLessThanOrEqual(h1.y + 30)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'test-artifacts/night-shelf.png' })
  })

  test('the theme is set before first paint (no flash of day)', async ({ page }) => {
    await mockPublished(page, manifestOf(BOOKS))
    await page.goto('/', { waitUntil: 'commit' })
    await page.waitForSelector('html[data-theme]', { state: 'attached' })
    expect(await page.locator('html').getAttribute('data-theme')).toBe('night')
  })

  test('shelf, dialogs and reader have no axe violations at night', async ({ page }) => {
    await shelf(page)
    const tags = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
    expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations.map((v) => v.id)).toEqual([])
    await page.getByRole('button', { name: 'Sign in' }).click()
    const d = page.getByRole('dialog', { name: 'Connect your library' })
    await d.getByLabel('Personal access token').fill('x')
    await d.getByRole('button', { name: 'Connect' }).click() // empty owner → error message
    await d.getByLabel('Repository owner').fill('')
    await d.getByRole('button', { name: 'Connect' }).click()
    await expect(d.getByRole('alert')).not.toBeEmpty()
    expect((await new AxeBuilder({ page }).withTags(tags).include('dialog').analyze()).violations.map((v) => v.id)).toEqual([])
    await d.getByRole('button', { name: 'Cancel' }).click()
    await page.goto('/#/read/p1')
    await page.locator('.reader-stage[data-ready]').waitFor()
    expect(await bg(page)).toBe('rgb(15, 23, 47)')
    expect(await page.locator('.pdf-page').first().evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(255, 255, 255)')
    expect((await new AxeBuilder({ page }).withTags(tags).exclude('.textLayer').analyze()).violations.map((v) => v.id)).toEqual([])
  })
})
