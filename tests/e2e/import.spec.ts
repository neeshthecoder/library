import AxeBuilder from '@axe-core/playwright'
import { type Page } from '@playwright/test'
import { contrast } from '../../src/spines/contrast'
import { asOwner, dropFiles, FakeGitHub, fixture, manifestOf, mockPublished, expect, test } from './helpers'

const drop = (page: Page, ...names: string[]) => dropFiles(page, names.map((name) => ({ name, buffer: fixture(name) })))
const preview = (page: Page) => page.getByRole('dialog', { name: 'Add to your shelf' })

async function ready(page: Page) {
  const gh = await asOwner(page)
  await expect(page.getByText('Drop a book anywhere to add it.')).toBeVisible()
  return gh
}

test.describe('drag overlay', () => {
  test('appears on file drag, survives crossing elements, hides on leave', async ({ page }) => {
    await ready(page)
    const dt = await page.evaluateHandle(() => {
      const d = new DataTransfer()
      d.items.add(new File(['x'], 'a.pdf'))
      return d
    })
    const overlay = page.locator('.drag-overlay')
    await page.dispatchEvent('body', 'dragenter', { dataTransfer: dt })
    await expect(overlay).toBeVisible()
    await expect(overlay).toContainText('Drag file here')
    let hidden = 0
    for (const sel of ['h1', '.shelf-footer', '.shelf-footer .link-btn', 'body']) {
      await page.dispatchEvent(sel, 'dragenter', { dataTransfer: dt })
      await page.dispatchEvent('body', 'dragleave', { dataTransfer: dt })
      await page.dispatchEvent(sel, 'dragover', { dataTransfer: dt })
      if (!(await overlay.isVisible())) hidden++
    }
    expect(hidden).toBe(0)
    await page.dispatchEvent('body', 'dragleave', { dataTransfer: dt, clientX: 0, clientY: 0 })
    await expect(overlay).toBeHidden()
  })

  test('ignores non-file drags', async ({ page }) => {
    await ready(page)
    const dt = await page.evaluateHandle(() => {
      const d = new DataTransfer()
      d.setData('text/plain', 'hello')
      return d
    })
    await page.dispatchEvent('body', 'dragenter', { dataTransfer: dt })
    await expect(page.locator('.drag-overlay')).toBeHidden()
  })

  test('the watchdog hides a stuck overlay', async ({ page }) => {
    await ready(page)
    const dt = await page.evaluateHandle(() => {
      const d = new DataTransfer()
      d.items.add(new File(['x'], 'a.pdf'))
      return d
    })
    await page.dispatchEvent('body', 'dragenter', { dataTransfer: dt })
    await expect(page.locator('.drag-overlay')).toBeVisible()
    await expect(page.locator('.drag-overlay')).toBeHidden({ timeout: 2000 })
  })
})

test.describe('guests', () => {
  test('cannot add books: no Add book, no overlay, drops ignored', async ({ page }) => {
    await new FakeGitHub().install(page)
    await mockPublished(page, manifestOf([]))
    await page.goto('/')
    await expect(page.getByText('No books on the shelf yet.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add book' })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    const dt = await page.evaluateHandle(() => { const d = new DataTransfer(); d.items.add(new File(['x'], 'a.epub')); return d })
    await page.dispatchEvent('body', 'dragenter', { dataTransfer: dt })
    await expect(page.locator('.drag-overlay')).toBeHidden()
    await drop(page, 'sample.epub')
    await page.waitForTimeout(800)
    await expect(preview(page)).toHaveCount(0)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(page.url()).toMatch(/localhost/) // the browser didn't navigate to the dropped file
  })
})

test.describe('import', () => {
  test('does not load renderers on the shelf', async ({ page }) => {
    const js: string[] = []
    page.on('request', (r) => r.resourceType() === 'script' && js.push(r.url()))
    await ready(page)
    await page.waitForLoadState('networkidle')
    expect(js.filter((u) => /pdf|foliate|view-|paginator|epub|mobi|zip/.test(u))).toEqual([])
  })

  test('prefills titles from metadata for every format', async ({ page }) => {
    await ready(page)
    const cases: [string, RegExp][] = [
      ['sample.epub', /^Middlemarch$/],
      ['sample.pdf', /^A Sample PDF$/],
      ['the_left-hand_of_darkness (2).pdf', /^The left hand of darkness$/],
      ['magi.mobi', /Gift of the Magi/i],
      ['magi.azw3', /Gift of the Magi/i],
    ]
    for (const [file, title] of cases) {
      await drop(page, file)
      const d = preview(page)
      await expect(d).toBeVisible({ timeout: 15000 })
      await expect(d.getByLabel('Title')).toHaveValue(title)
      await d.getByRole('button', { name: 'Cancel' }).click()
      await expect(d).toBeHidden()
    }
  })

  test('preview: cover colors, live updates, shuffle, validation, focus', async ({ page }) => {
    await ready(page)
    await page.getByRole('button', { name: 'Add book' }).focus()
    await drop(page, 'sample.epub')
    const d = preview(page)
    await expect(d.getByLabel('Title')).toBeFocused()
    await expect(d.getByRole('tab')).toHaveCount(0) // no design choices any more
    await expect(d).toContainText('Colors from the book’s cover.')
    // cover colors: green background, orange bands
    const bg = await d.locator('[data-preview]').evaluate((e) => getComputedStyle(e).getPropertyValue('--bg'))
    expect(bg.trim()).toMatch(/^#(2[0-9a-f]|3[0-9a-f])[3-4][0-9a-f]/i)
    await expect(d.locator('[data-preview] svg circle, [data-preview] svg polygon, [data-preview] svg path')).toHaveCount(0)

    await d.getByLabel('Title').fill('A New Title')
    await expect(d.locator('[data-preview] .spine-title')).toHaveText('A New Title')

    const colors = async () => ({ bg: await d.getByLabel('Background').inputValue(), trim: await d.getByLabel('Bands').inputValue() })
    const cover = await colors()
    await d.getByRole('button', { name: 'Shuffle colors' }).click()
    const after = await colors()
    expect(after).not.toEqual(cover)
    expect(contrast(after.bg, after.trim)).toBeGreaterThanOrEqual(3)
    await d.getByRole('button', { name: 'Use cover colors' }).click()
    expect(await colors()).toEqual(cover)
    await expect(d.getByRole('button', { name: 'Use cover colors' })).toBeHidden()

    await d.getByLabel('Background').fill('#808080')
    const ink = await d.locator('[data-preview]').evaluate((e) => getComputedStyle(e).getPropertyValue('--title-ink').trim())
    expect(contrast('#808080', ink)).toBeGreaterThanOrEqual(4.5)

    const axe = await new AxeBuilder({ page }).include('dialog').analyze()
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([])

    await d.getByLabel('Title').fill('   ')
    await d.getByRole('button', { name: 'Add to shelf' }).click()
    await expect(d.getByText('Add a title.')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(d).toBeHidden()
    await expect(page.getByRole('button', { name: 'Add book' })).toBeFocused()
  })

  test('books without a cover get generated colors', async ({ page }) => {
    await ready(page)
    await drop(page, 'nocover.epub')
    const d = preview(page)
    await expect(d).toContainText('This book has no cover')
    await expect(d.getByRole('button', { name: 'Use cover colors' })).toHaveCount(0)
    const c = { bg: await d.getByLabel('Background').inputValue(), trim: await d.getByLabel('Bands').inputValue() }
    expect(contrast(c.bg, c.trim)).toBeGreaterThanOrEqual(3)
  })

  test('rejects unsupported, DRM, password, and oversized files with plain messages', async ({ page }) => {
    await ready(page)
    await drop(page, 'notes.docx')
    await expect(page.getByRole('alert')).toHaveText(/That file type isn’t supported\. Add a PDF, EPUB, MOBI, or AZW3 file\./)
    await drop(page, 'drm.epub')
    await expect(page.getByRole('alert')).toContainText('This book is DRM-protected, so it can’t be opened here. Add a DRM-free copy.')
    await drop(page, 'notes.docx')
    await expect(page.getByRole('alert')).toContainText('isn’t supported')
    await drop(page, 'drm.mobi')
    await expect(page.getByRole('alert')).toContainText('DRM-protected')
    await drop(page, 'password.pdf')
    await expect(page.getByRole('alert')).toContainText('This PDF needs a password to open. Add an unlocked copy.')
    await drop(page, 'fonts.epub')
    await expect(preview(page)).toBeVisible()
    await preview(page).getByRole('button', { name: 'Cancel' }).click()
    await drop(page, 'owner-only.pdf')
    await expect(preview(page)).toBeVisible()
    await preview(page).getByRole('button', { name: 'Cancel' }).click()
    // a 101 MB PDF (sparse) is rejected before upload
    const big = await page.evaluateHandle(() => {
      const d = new DataTransfer()
      d.items.add(new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), new Uint8Array(101 * 1024 * 1024)], 'huge.pdf'))
      return d
    })
    await page.dispatchEvent('body', 'dragenter', { dataTransfer: big })
    await page.dispatchEvent('body', 'drop', { dataTransfer: big })
    await expect(page.getByRole('alert')).toContainText('This file is 101 MB. The limit is 100 MB.')
  })

  test('a drop during another import is queued, not ignored', async ({ page }) => {
    await ready(page)
    await drop(page, 'sample.epub')
    await expect(preview(page)).toBeVisible()
    await drop(page, 'nocover.epub')
    await preview(page).getByRole('button', { name: 'Cancel' }).click()
    await expect(preview(page).getByLabel('Title')).toHaveValue('A Book Without a Cover')
  })

  test('queues several files and reports rejections together', async ({ page }) => {
    const gh = await ready(page)
    await dropFiles(page, [
      { name: 'one.epub', buffer: fixture('sample.epub') },
      { name: 'notes.docx', buffer: fixture('notes.docx') },
      { name: 'two.epub', buffer: fixture('nocover.epub') },
    ])
    await expect(page.getByRole('alert')).toContainText('notes.docx: That file type isn’t supported')
    const d = preview(page)
    await expect(d.getByText('Book 1 of 2')).toBeVisible()
    await d.getByRole('button', { name: 'Cancel' }).click()
    await expect(d.getByText('Book 2 of 2')).toBeVisible()
    await expect(d.getByLabel('Title')).toHaveValue('A Book Without a Cover')
    await d.getByRole('button', { name: 'Add to shelf' }).click()
    await expect(page.getByRole('button', { name: 'A Book Without a Cover' })).toBeVisible()
    await expect.poll(() => gh.pushes).toEqual(['Add "A Book Without a Cover"'])
  })

  test('adds a book and uploads it as one commit', async ({ page }) => {
    const gh = await ready(page)
    await drop(page, 'sample.epub')
    await preview(page).getByRole('button', { name: 'Add to shelf' }).click()
    await expect(page.getByRole('button', { name: 'Middlemarch' })).toBeVisible()
    await expect.poll(() => gh.pushes).toEqual(['Add "Middlemarch"'])
    const m = gh.manifest()
    expect(m.books[0].title).toBe('Middlemarch')
    expect(m.books[0].spine.source).toBe('cover')
    expect(gh.file(m.books[0].file)!.equals(fixture('sample.epub'))).toBe(true)
    await expect(page.locator('.shelf-status')).toBeEmpty()
  })

  test('offline upload stays on the shelf with a retry', async ({ page }) => {
    const gh = await ready(page)
    gh.offline = true
    await drop(page, 'sample.epub')
    await preview(page).getByRole('button', { name: 'Add to shelf' }).click()
    await expect(page.getByRole('button', { name: 'Middlemarch' })).toBeVisible()
    await expect(page.locator('.shelf-status')).toContainText('Middlemarch isn’t uploaded yet.')
    // the error note must not cover the retry link
    const note = (await page.locator('.app-message-card').boundingBox())!
    const retry = (await page.getByRole('button', { name: 'Retry upload' }).boundingBox())!
    expect(note.y + note.height <= retry.y || retry.y + retry.height <= note.y).toBe(true)
    gh.offline = false
    await page.getByRole('button', { name: 'Retry upload' }).click()
    await expect.poll(() => gh.pushes).toEqual(['Add "Middlemarch"'])
    await expect(page.locator('.shelf-status')).toBeEmpty()
  })

  test('a dropped book on the reader opens the preview', async ({ page }) => {
    const { makeBook } = await import('./helpers')
    await asOwner(page, [makeBook({ id: 'b1', title: 'Emma' })], { 'b1.epub': fixture('sample.epub') }, '/#/read/b1')
    await expect(page.getByRole('button', { name: 'Back to shelf' })).toBeVisible()
    await drop(page, 'nocover.epub')
    await expect(preview(page)).toBeVisible()
  })
})
