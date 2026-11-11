import AxeBuilder from '@axe-core/playwright'
import { type Page } from '@playwright/test'
import { LEADERBOARD_TEST_URL } from './leaderboard-url'
import { dropFiles, FakeGitHub, fixture, makeBook, manifestOf, mockPublished, connect, expect, setTheme, test } from './helpers'

const BOOKS = Array.from({ length: 12 }, (_, i) => makeBook({ id: `b${i + 1}`, title: ['Middlemarch', 'Emma', 'Beloved', 'Dune'][i % 4] + (i > 3 ? ` ${i}` : ''), format: i === 0 ? 'pdf' : 'epub', ...(i === 1 ? { author: 'Jane Austen', spine: { ...makeBook({ id: 'x' }).spine, font: 'eb-garamond' } } : {}) }))
const FILES = { 'b1.pdf': fixture('sample.pdf'), ...Object.fromEntries(BOOKS.slice(1).map((b) => [`${b.id}.epub`, fixture('sample.epub')])) }

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
async function axe(page: Page, include?: string) {
  let b = new AxeBuilder({ page }).withTags(TAGS).exclude('.textLayer').exclude('foliate-view')
  if (include) b = b.include(include)
  const r = await b.analyze()
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)
}

type View = { name: string; open(page: Page): Promise<void>; scope?: string }

/** Opens the leaderboard check-in and walks it to a given step. */
async function leaderboard(p: Page, upTo: 'initial' | 'soon' | 'book' | 'page' | 'board') {
  await p.goto('/')
  await p.getByRole('button', { name: 'Acorns' }).click()
  const d = p.getByRole('dialog')
  await d.waitFor()
  if (upTo === 'initial') return
  await p.getByLabel('Your initial').fill(upTo === 'soon' ? 'Q' : 'M')
  await p.getByRole('button', { name: 'Next' }).click()
  if (upTo === 'soon') return void (await d.getByRole('heading', { name: 'Feature Coming Soon!' }).waitFor())
  if (upTo === 'book') return void (await p.getByLabel('Which book?').waitFor())
  if (upTo === 'board') {
    await p.getByRole('button', { name: 'Just show the board' }).click()
    return void (await d.locator('.lb-board').waitFor())
  }
  await p.getByLabel('Which book?').selectOption('b2')
  await p.getByRole('button', { name: 'Next' }).click()
  await p.getByLabel('Last page read').waitFor()
}
const LEADERBOARD_STEPS: View[] = (['initial', 'soon', 'book', 'page', 'board'] as const).map((step) => ({
  name: `leaderboard ${step}`, scope: 'dialog', open: (p) => leaderboard(p, step),
}))
const VIEWS: View[] = [
  { name: 'shelf', open: async (p) => { await p.goto('/'); await p.locator('.spine').first().waitFor() } },
  { name: 'empty shelf', open: async (p) => { await p.unroute('**/library/manifest.json*'); await mockPublished(p, manifestOf([])); await p.goto('/'); await p.getByText('No books on the shelf yet.').waitFor() } },
  { name: 'reader', open: async (p) => { await p.goto('/#/read/b1'); await p.locator('.reader-stage[data-ready]').waitFor() } },
  { name: 'preview dialog', scope: 'dialog', open: async (p) => { await p.goto('/'); await connect(p); await p.locator('.spine').first().waitFor(); await dropFiles(p, [{ name: 'sample.epub', buffer: fixture('sample.epub') }]); await p.getByRole('dialog', { name: 'Add to your shelf' }).waitFor() } },
  { name: 'connect dialog', scope: 'dialog', open: async (p) => { await p.goto('/'); await p.getByRole('button', { name: 'Sign in' }).click(); await p.getByRole('dialog', { name: 'Connect your library' }).waitFor() } },
  { name: 'settings dialog', scope: 'dialog', open: async (p) => { await p.goto('/'); await connect(p); await p.getByRole('button', { name: 'Library settings' }).click(); await p.getByRole('dialog', { name: 'Library settings' }).waitFor() } },
  ...LEADERBOARD_STEPS,
  { name: 'delete dialog', scope: 'dialog', open: async (p) => {
    await p.goto('/'); await connect(p)
    await p.goto('/#/read/b1'); await p.locator('.reader-stage[data-ready]').waitFor(); await p.getByRole('button', { name: 'Delete book' }).click(); await p.getByRole('alertdialog').waitFor()
  } },
]

async function setup(page: Page) {
  await new FakeGitHub(manifestOf(BOOKS)).install(page)
  const board = { A: { bookId: 'b2', title: 'Emma', page: 120, pages: 200, percent: 60, updatedAt: '2026-11-08T00:00:00Z' }, M: null }
  await page.route(`${LEADERBOARD_TEST_URL}/**`, (route) =>
    route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify(board) }),
  )
  await mockPublished(page, manifestOf(BOOKS), FILES)
}

/** Interactive elements smaller than 44×44 (visible ones only). */
async function smallTargets(page: Page, scope = 'body') {
  return page.locator(scope).evaluate((root) => {
    const out: string[] = []
    root.querySelectorAll<HTMLElement>('button, a[href], input:not([type="hidden"]), [role="tab"]').forEach((el) => {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') return
      if (el.closest('.visually-hidden')) return
      if (r.width < 44 - 0.5 || r.height < 44 - 0.5) out.push(`${el.tagName.toLowerCase()} "${el.getAttribute('aria-label') ?? el.textContent?.trim()}" ${Math.round(r.width)}×${Math.round(r.height)}`)
    })
    return out
  })
}

for (const view of VIEWS) {
  test(`${view.name}: no axe violations`, async ({ page }) => {
    await setup(page)
    await view.open(page)
    expect(await axe(page, view.scope)).toEqual([])
  })

  for (const [w, h, zoom] of [[320, 640, 1], [768, 1024, 1], [1440, 900, 1], [1280, 800, 2]] as const) {
    test(`${view.name}: layout at ${w}px${zoom > 1 ? ' and 200% zoom' : ''}`, async ({ browser }) => {
      // 200% zoom is emulated as half the CSS viewport at twice the pixel density.
      const ctx = await browser.newContext({ viewport: { width: w / zoom, height: h / zoom }, deviceScaleFactor: zoom })
      const page = await ctx.newPage()
    await setTheme(page, 'day')
      await setup(page)
      await view.open(page)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, 'horizontal page overflow').toBeLessThanOrEqual(0)
      expect(await smallTargets(page, view.scope ?? 'body')).toEqual([])
      await page.screenshot({ path: `test-artifacts/${view.name.replace(/\s/g, '-')}-${w}${zoom > 1 ? '-zoom200' : ''}.png` })
      await ctx.close()
    })
  }
}

test('a spine with an author names it in its accessible name and tooltip', async ({ page }) => {
  await setup(page)
  await page.goto('/')
  const spine = page.getByRole('button', { name: 'Emma, Jane Austen', exact: true })
  await expect(spine).toHaveAttribute('title', 'Emma by Jane Austen')
  await expect(spine.locator('.spine-author')).toHaveText('Jane Austen')
  await expect(page.getByRole('button', { name: 'Middlemarch', exact: true })).toHaveCount(1) // no author: just the title
})
