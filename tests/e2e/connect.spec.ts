import AxeBuilder from '@axe-core/playwright'
import { type Page } from '@playwright/test'
import { connect, expect, FakeGitHub, fillConnect, manifestOf, mockPublished, test } from './helpers'

async function openSignIn(page: Page) {
  await page.getByRole('button', { name: 'Sign in' }).click()
  return page.getByRole('dialog', { name: 'Connect your library' })
}
async function tryToken(page: Page, token: string) {
  const d = await openSignIn(page)
  await d.getByLabel('Repository owner').fill('me')
  await d.getByLabel('Repository name').fill('library')
  await d.getByLabel('Personal access token').fill(token)
  await d.getByRole('button', { name: 'Connect' }).click()
  return d
}

test.describe('signing in', () => {
  test('signs in with a valid token and shows the public notice', async ({ page }) => {
    const gh = new FakeGitHub()
    await gh.install(page)
    await mockPublished(page, manifestOf([]))
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Library settings' })).toBeHidden()
    const d = await openSignIn(page)
    await expect(d).toContainText('Anyone with the link can download them')
    await expect(d).toContainText('stay in the repository’s history')
    await expect(d.getByLabel('Personal access token')).toHaveAttribute('type', 'password')
    const axe = await new AxeBuilder({ page }).include('dialog').analyze()
    expect(axe.violations.map((v) => v.id)).toEqual([])
    await fillConnect(page)
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Add book' })).toBeVisible()
    await page.getByRole('button', { name: 'Library settings' }).click()
    await expect(page.getByRole('dialog', { name: 'Library settings' })).toContainText('Connected to me/library')
  })

  test('explains a token without write access', async ({ page }) => {
    const gh = new FakeGitHub()
    gh.permissions = { push: false }
    await gh.install(page)
    await mockPublished(page, manifestOf([]))
    await page.goto('/')
    const d = await tryToken(page, 'read_only')
    await expect(d.getByRole('alert')).toContainText('can’t write to me/library')
    await expect(d.getByRole('alert')).toContainText('Contents: Read and write')
  })

  test('catches a fine-grained token without Contents: write on an owned repo', async ({ page }) => {
    const gh = new FakeGitHub()
    gh.tokenCanWrite = false // permissions.push is still true: the account owns the repo
    await gh.install(page)
    await mockPublished(page, manifestOf([]))
    await page.goto('/')
    const d = await tryToken(page, 'github_pat_readonly')
    await expect(d.getByRole('alert')).toContainText('can’t write to me/library')
  })

  test('explains a rejected token', async ({ page }) => {
    const gh = new FakeGitHub()
    gh.tokenOk = false
    await gh.install(page)
    await mockPublished(page, manifestOf([]))
    await page.goto('/')
    const d = await tryToken(page, 'bad')
    await expect(d.getByRole('alert')).toContainText('wasn’t accepted')
  })

  test('disconnect erases the token, cached books and positions', async ({ page }) => {
    const gh = new FakeGitHub()
    await gh.install(page)
    await mockPublished(page, manifestOf([]))
    await page.goto('/')
    await connect(page)
    const stored = () => page.evaluate(() => new Promise<unknown>((resolve) => {
      const req = indexedDB.open('virtual-library')
      req.onsuccess = () => {
        const g = req.result.transaction('settings').objectStore('settings').get('github')
        g.onsuccess = () => resolve(g.result ?? null)
      }
    }))
    await expect.poll(stored).toMatchObject({ token: 'github_pat_test' })
    await page.getByRole('button', { name: 'Library settings' }).click()
    const settings = page.getByRole('dialog', { name: 'Library settings' })
    await expect(settings).toContainText('removes the token, cached books, and reading positions')
    await settings.getByRole('button', { name: 'Disconnect' }).click()
    await expect(page.getByRole('alert')).toContainText('disconnected')
    await expect.poll(stored).toBeNull()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add book' })).toBeHidden()
  })
})
