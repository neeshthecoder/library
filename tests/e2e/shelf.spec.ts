import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { makeBook, manifestOf, mockPublished } from './helpers'
import type { TrimDesign } from '../../src/storage/manifest'

const TITLES = ['Middlemarch', 'Emma', 'The Left Hand of Darkness', 'Beloved', 'A Very Long Title That Will Not Fit On One Line At All, Not Even Close', 'Dune', 'Persuasion', 'The Remains of the Day', 'Kindred', 'Possession', 'Ulysses', 'Gilead', 'Atonement', 'Wolf Hall', 'Never Let Me Go', 'Housekeeping', 'Middlesex', 'Austerlitz']
const designs: TrimDesign[] = ['frame', 'medallion', 'arch']
const palettes = [['#24413a', '#e0864a'], ['#2c2f4f', '#d9b25f'], ['#e8dcc4', '#7a2e3b'], ['#3b2a2a', '#9fd0c0'], ['#1f3b4d', '#f2a65a']]

function shelfBooks(n = TITLES.length) {
  return TITLES.slice(0, n).map((title, i) => {
    const [bg, trim] = palettes[i % palettes.length]
    return makeBook({
      id: `b${i + 1}`,
      title,
      spine: i % 4 === 3
        ? { source: 'cover', bg, trim, ink: trim, h: 0.74 + ((i * 37) % 24) / 100, w: 0.13 + ((i * 13) % 8) / 100 }
        : { source: 'trim', design: designs[i % 3], bg, trim, ink: trim, h: 0.74 + ((i * 37) % 24) / 100, w: 0.13 + ((i * 13) % 8) / 100 },
      position: i % 5 === 1 ? { locator: '3', fraction: 0.34, label: '34%', updatedAt: '2026-01-02T00:00:00Z' } : null,
    })
  })
}

test.describe('bookshelf', () => {
  test('shows the empty state', async ({ page }) => {
    await mockPublished(page, manifestOf([]))
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'The bookshelf.' })).toBeVisible()
    await expect(page.getByText('Drop a book anywhere to add it.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add book' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Shelf' })).toBeHidden()
  })

  test('orders spines oldest to newest and exposes full titles', async ({ page }) => {
    const books = shelfBooks(5).reverse() // manifest order shouldn't matter
    await mockPublished(page, manifestOf(books))
    await page.goto('/')
    const names = await page.locator('.spine').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
    expect(names).toEqual(TITLES.slice(0, 5))
    const long = page.getByRole('button', { name: TITLES[4] })
    await expect(long).toHaveAttribute('title', TITLES[4])
    await expect(page.locator('.spine').nth(1).locator('.spine-ribbon')).toHaveCount(1)
    await expect(page.locator('.spine').nth(0).locator('.spine-ribbon')).toHaveCount(0)
    await expect(page.getByText('5 books · 34 KB of about 1 GB')).toBeVisible()
  })

  test('shelf bar ends just past the last spine', async ({ page }) => {
    await mockPublished(page, manifestOf(shelfBooks(3)))
    await page.goto('/')
    const last = await page.locator('.spine').last().boundingBox()
    const first = await page.locator('.spine').first().boundingBox()
    const bar = await page.locator('.shelf-bar').boundingBox()
    expect(Math.abs(bar!.x - first!.x)).toBeLessThan(1)
    const overhang = bar!.x + bar!.width - (last!.x + last!.width)
    expect(overhang).toBeGreaterThan(20)
    expect(overhang).toBeLessThan(30)
  })

  for (const width of [320, 768, 1440]) {
    test(`layout at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 320 ? 640 : 900 })
      await mockPublished(page, manifestOf(shelfBooks()))
      await page.goto('/')
      await page.evaluate(() => document.fonts.ready)
      await expect(page.locator('.spine')).toHaveCount(TITLES.length)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBeLessThanOrEqual(0)
      for (const box of await page.locator('.spine').evaluateAll((els) => els.slice(0, 6).map((e) => e.getBoundingClientRect().width))) {
        expect(box).toBeGreaterThanOrEqual(44)
      }
      await page.screenshot({ path: `test-artifacts/shelf-${width}.png` })
    })
  }

  test('vertical wheel scrolls the shelf, then the page at the end', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 600 })
    await mockPublished(page, manifestOf(shelfBooks()))
    await page.goto('/')
    const scroller = page.locator('.shelf-scroller')
    await scroller.hover()
    await page.mouse.wheel(0, 300)
    await expect.poll(() => scroller.evaluate((e) => e.scrollLeft)).toBeGreaterThan(200)
    await scroller.evaluate((e) => (e.scrollLeft = e.scrollWidth))
    const before = await page.evaluate(() => scrollY)
    await page.mouse.wheel(0, 300)
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before)
  })

  test('keyboard: roving focus, arrows, Home/End, Enter opens', async ({ page }) => {
    await mockPublished(page, manifestOf(shelfBooks(8)))
    await page.goto('/')
    await page.getByRole('button', { name: 'Middlemarch' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('button', { name: 'Emma' })).toBeFocused()
    await page.keyboard.press('End')
    await expect(page.getByRole('button', { name: TITLES[7] })).toBeFocused()
    await page.keyboard.press('Home')
    await expect(page.getByRole('button', { name: 'Middlemarch' })).toBeFocused()
    // one tab stop for the whole shelf
    const tabbable = await page.locator('.spine[tabindex="0"]').count()
    expect(tabbable).toBe(1)
    // the lift is a transform
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => page.getByRole('button', { name: 'Emma' }).evaluate((e) => getComputedStyle(e).transform)).not.toBe('none')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#\/read\/b2$/)
  })

  test('started books describe their progress', async ({ page }) => {
    await mockPublished(page, manifestOf(shelfBooks(3)))
    await page.goto('/')
    const emma = page.getByRole('button', { name: 'Emma' })
    await expect(emma).toHaveAccessibleDescription('In progress, 34%')
  })

  test('has no axe violations', async ({ page }) => {
    await mockPublished(page, manifestOf(shelfBooks(6)))
    await page.goto('/')
    await page.locator('.spine').first().waitFor()
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([])
  })

  test('removes the lift transition under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await mockPublished(page, manifestOf(shelfBooks(2)))
    await page.goto('/')
    const d = await page.locator('.spine').first().evaluate((e) => getComputedStyle(e).transitionDuration)
    expect(['0s', '1e-05s']).toContain(d)
  })
})
