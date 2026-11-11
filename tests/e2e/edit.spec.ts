import AxeBuilder from '@axe-core/playwright'
import { type Page } from '@playwright/test'
import { asOwner, expect, fixture, makeBook, manifestOf, mockPublished, test } from './helpers'
import type { Book } from '../../src/storage/manifest'

test.use({ viewport: { width: 1280, height: 800 } })

const BOOKS: Book[] = [
  makeBook({ id: 'b1', title: 'Midlemarch', author: 'George Eliot', position: { locator: '3', fraction: 0.3, label: '30%', updatedAt: '2026-01-05T00:00:00Z' } }),
  makeBook({ id: 'b2', title: 'Emma' }),
]
const FILES = { 'b1.epub': fixture('sample.epub'), 'b2.epub': fixture('sample.epub') }
const menu = (page: Page) => page.getByRole('menu')
const editDialog = (page: Page) => page.getByRole('dialog', { name: 'Edit book' })

async function openEdit(page: Page, name: string | RegExp) {
  await page.getByRole('button', { name }).click({ button: 'right' })
  await menu(page).getByRole('menuitem', { name: 'Edit' }).click()
  await expect(editDialog(page)).toBeVisible()
}

test('owner right-click opens a menu with Edit, instead of the browser menu', async ({ page }) => {
  await asOwner(page, BOOKS, FILES)
  const spine = page.getByRole('button', { name: 'Emma', exact: true })
  const prevented = await spine.evaluate((el) => {
    const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 })
    el.dispatchEvent(e)
    return e.defaultPrevented
  })
  expect(prevented).toBe(true)
  await expect(menu(page).getByRole('menuitem')).toHaveText(['Edit'])
  expect(await new AxeBuilder({ page }).include('.spine-menu').analyze().then((r) => r.violations.map((v) => v.id))).toEqual([])
  // clicking elsewhere closes it
  await page.mouse.click(5, 5)
  await expect(menu(page)).toHaveCount(0)
})

test('Shift+F10 on a focused spine opens the menu with Edit focused; Escape returns to the spine', async ({ page }) => {
  await asOwner(page, BOOKS, FILES)
  const spine = page.getByRole('button', { name: 'Emma', exact: true })
  await spine.focus()
  await page.keyboard.press('Shift+F10')
  await expect(menu(page).getByRole('menuitem', { name: 'Edit' })).toBeFocused()
  // anchored next to the spine
  const s = (await spine.boundingBox())!
  const m = (await menu(page).boundingBox())!
  expect(Math.abs(m.x - (s.x + s.width + 4))).toBeLessThan(2)
  await page.keyboard.press('Escape')
  await expect(menu(page)).toHaveCount(0)
  await expect(spine).toBeFocused()
  // the context-menu key works too, and Enter chooses Edit
  await page.keyboard.press('ContextMenu')
  await page.keyboard.press('Enter')
  await expect(editDialog(page)).toBeVisible()
})

test('guests get no Edit menu', async ({ page }) => {
  await mockPublished(page, manifestOf(BOOKS), FILES)
  await page.goto('/')
  const spine = page.getByRole('button', { name: 'Emma', exact: true })
  const prevented = await spine.evaluate((el) => {
    const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    el.dispatchEvent(e)
    return e.defaultPrevented
  })
  expect(prevented).toBe(false)
  await spine.focus()
  await page.keyboard.press('Shift+F10')
  await expect(menu(page)).toHaveCount(0)
})

test('renaming a book updates the spine and commits once, keeping its place', async ({ page }) => {
  const gh = await asOwner(page, BOOKS, FILES)
  await openEdit(page, 'Midlemarch, George Eliot')
  const d = editDialog(page)
  await expect(d.getByLabel('Title')).toHaveValue('Midlemarch')
  await expect(d.getByLabel('Author')).toHaveValue('George Eliot')
  await expect(d.getByRole('radio', { name: 'Instrument Serif' })).toBeChecked()
  expect(await new AxeBuilder({ page }).include('dialog').analyze().then((r) => r.violations.map((v) => v.id))).toEqual([])
  await d.getByLabel('Title').fill('Middlemarch')
  await d.getByText('Crimson Pro').click()
  await d.getByRole('button', { name: 'Save' }).click()
  await expect(d).toBeHidden()

  const spine = page.getByRole('button', { name: 'Middlemarch, George Eliot' })
  await expect(spine).toBeVisible()
  await expect(spine).toHaveAttribute('title', 'Middlemarch by George Eliot')
  await expect(spine).toHaveAttribute('data-font', 'crimson-pro')
  await expect(spine).toBeFocused() // focus comes back to the spine
  await expect.poll(() => gh.pushes).toEqual(['Edit "Middlemarch"'])
  const b = gh.manifest().books.find((x) => x.id === 'b1')!
  expect(b).toMatchObject({ title: 'Middlemarch', author: 'George Eliot', position: { locator: '3' }, spine: { font: 'crimson-pro', h: 0.9, w: 0.16, bg: '#24413a' } })
})

test('clearing the author removes the author line', async ({ page }) => {
  const gh = await asOwner(page, BOOKS, FILES)
  await openEdit(page, 'Midlemarch, George Eliot')
  await editDialog(page).getByLabel('Author').fill('')
  await editDialog(page).getByRole('button', { name: 'Save' }).click()
  const spine = page.getByRole('button', { name: 'Midlemarch', exact: true })
  await expect(spine.locator('.spine-author')).toHaveCount(0)
  await expect.poll(() => gh.pushes).toEqual(['Edit "Midlemarch"'])
  expect(gh.manifest().books.find((x) => x.id === 'b1')!.author).toBeNull()
})

test('Cancel, Escape, or saving without changes commits nothing', async ({ page }) => {
  const gh = await asOwner(page, BOOKS, FILES)
  await openEdit(page, 'Emma')
  await editDialog(page).getByLabel('Title').fill('Something else')
  await editDialog(page).getByRole('button', { name: 'Cancel' }).click()
  await openEdit(page, 'Emma')
  await page.keyboard.press('Escape')
  await openEdit(page, 'Emma')
  await editDialog(page).getByRole('button', { name: 'Save' }).click()
  await expect(editDialog(page)).toBeHidden()
  await expect(page.getByRole('button', { name: 'Emma', exact: true })).toBeVisible()
  await page.waitForTimeout(300)
  expect(gh.pushes).toEqual([])
})

test('an empty title is refused', async ({ page }) => {
  const gh = await asOwner(page, BOOKS, FILES)
  await openEdit(page, 'Emma')
  await editDialog(page).getByLabel('Title').fill('  ')
  await editDialog(page).getByRole('button', { name: 'Save' }).click()
  await expect(editDialog(page).getByText('Add a title.')).toBeVisible()
  expect(gh.pushes).toEqual([])
})

test('an offline save reverts and says so', async ({ page }) => {
  const gh = await asOwner(page, BOOKS, FILES)
  gh.offline = true
  await openEdit(page, 'Emma')
  await editDialog(page).getByLabel('Title').fill('Emma Woodhouse')
  await editDialog(page).getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Emma: changes couldn’t be saved.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Emma', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Emma Woodhouse' })).toHaveCount(0)
})

test('touch: press and hold, then lift without moving, opens the menu', async ({ browser }) => {
  const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  const gh = await asOwner(page, BOOKS, FILES)
  const spine = page.getByRole('button', { name: 'Emma', exact: true })
  const b = (await spine.boundingBox())!
  const x = b.x + b.width / 2
  const y = b.y + b.height / 2
  await spine.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 5, isPrimary: true, button: 0, clientX: x, clientY: y })
  await page.waitForTimeout(450) // long press
  await page.evaluate(([px, py]) => window.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'touch', pointerId: 5, clientX: px + 3, clientY: py })), [x, y])
  await page.evaluate(([px, py]) => window.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', pointerId: 5, clientX: px + 3, clientY: py })), [x, y])
  await expect(menu(page).getByRole('menuitem', { name: 'Edit' })).toBeVisible()
  await expect(page.locator('.spine-drag-ghost')).toHaveCount(0)
  // the release didn't open the book
  await expect(page).not.toHaveURL(/#\/read\//)
  expect(gh.pushes).toEqual([])
  await menu(page).getByRole('menuitem', { name: 'Edit' }).click()
  await expect(editDialog(page)).toBeVisible()
  await ctx.close()
})
