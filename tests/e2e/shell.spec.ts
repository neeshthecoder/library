import { expect, test } from '@playwright/test'
import { fixture, makeBook, manifestOf, mockPublished } from './helpers'

test.describe('site shell', () => {
  test('preloads the serif and makes no third-party font requests', async ({ page }) => {
    const external: string[] = []
    page.on('request', (r) => {
      const u = new URL(r.url())
      if (u.hostname !== 'localhost') external.push(r.url())
    })
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'The bookshelf.' })).toBeVisible()
    const preload = await page.locator('link[rel="preload"][as="font"]').getAttribute('href')
    expect(preload).toMatch(/instrument-serif-latin-400\.woff2$/)
    await page.evaluate(() => document.fonts.ready)
    expect(external).toEqual([])
  })

  test('keeps layout shift under 0.05 when fonts arrive late', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'layout-shift entries are Chromium-only')
    await page.route('**/fonts/*.woff2', async (route) => {
      await new Promise((r) => setTimeout(r, 800))
      await route.continue()
    })
    await mockPublished(page, manifestOf([makeBook({ id: 'b1', title: 'Middlemarch' }), makeBook({ id: 'b2', title: 'Emma' })]))
    await page.addInitScript(() => {
      ;(window as unknown as { __cls: number }).__cls = 0
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
          if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value
        }
      }).observe({ type: 'layout-shift', buffered: true })
    })
    await page.goto('/')
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(500)
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls)
    expect(cls).toBeLessThan(0.05)
  })

  test('enforces the Content Security Policy for disallowed hosts @cross', async ({ page }) => {
    await page.goto('/')
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain('connect-src \'self\' https://api.github.com')
    const result = await page.evaluate(async () => {
      try {
        await fetch('https://example.com/')
        return 'allowed'
      } catch {
        return 'blocked'
      }
    })
    expect(result).toBe('blocked')
  })

  test('carries noindex and serves robots.txt', async ({ page, request }) => {
    await page.goto('/')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
    const robots = await (await request.get('/robots.txt')).text()
    expect(robots).toContain('Disallow: /')
  })

  test('routes: back, forward, reload, and unknown ids', async ({ page }) => {
    await mockPublished(page, manifestOf([makeBook({ id: 'b1', title: 'Middlemarch' })]), { 'b1.epub': fixture('sample.epub') })
    await page.goto('/')
    await page.getByRole('button', { name: 'Middlemarch' }).click()
    await expect(page).toHaveURL(/#\/read\/b1$/)
    await expect(page.getByRole('button', { name: 'Back to shelf' })).toBeVisible()
    await page.goBack()
    await expect(page.getByRole('heading', { name: 'The bookshelf.' })).toBeVisible()
    await page.goForward()
    await expect(page.getByRole('button', { name: 'Back to shelf' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Back to shelf' })).toBeVisible()
    await page.goto('/#/read/nope123')
    await expect(page.getByRole('heading', { name: 'The bookshelf.' })).toBeVisible()
    await expect(page.getByRole('alert')).toContainText('no longer in the library')
  })
})
