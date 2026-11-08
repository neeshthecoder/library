import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { FakeGitHub, fillConnect, manifestOf, mockPublished } from './helpers'

test.describe('connect your library', () => {
  test('connects with a valid token and shows the public notice', async ({ page }) => {
    const gh = new FakeGitHub()
    await gh.install(page)
    await mockPublished(page, manifestOf([]))
    await page.goto('/')
    await page.getByRole('button', { name: 'Library settings' }).click()
    const settings = page.getByRole('dialog', { name: 'Library settings' })
    await expect(settings).toContainText('isn’t connected')
    await settings.getByRole('button', { name: 'Connect' }).click()
    const d = page.getByRole('dialog', { name: 'Connect your library' })
    await expect(d).toContainText('Anyone with the link can download them')
    await expect(d).toContainText('stay in the repository’s history')
    await expect(d.getByLabel('Personal access token')).toHaveAttribute('type', 'password')
    const axe = await new AxeBuilder({ page }).include('dialog').analyze()
    expect(axe.violations.map((v) => v.id)).toEqual([])
    await fillConnect(page)
    await page.getByRole('button', { name: 'Library settings' }).click()
    await expect(page.getByRole('dialog', { name: 'Library settings' })).toContainText('Connected to me/library')
  })

  test('explains a token without write access', async ({ page }) => {
    const gh = new FakeGitHub()
    gh.permissions = { push: false }
    await gh.install(page)
    await mockPublished(page, manifestOf([]))
    await page.goto('/')
    await page.getByRole('button', { name: 'Library settings' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Connect' }).click()
    const d = page.getByRole('dialog', { name: 'Connect your library' })
    await d.getByLabel('Repository owner').fill('me')
    await d.getByLabel('Repository name').fill('library')
    await d.getByLabel('Personal access token').fill('read_only')
    await d.getByRole('button', { name: 'Connect' }).click()
    await expect(d.getByRole('alert')).toContainText('can’t write to me/library')
    await expect(d.getByRole('alert')).toContainText('Contents: Read and write')
  })

  test('catches a fine-grained token without Contents: write on an owned repo', async ({ page }) => {
    const gh = new FakeGitHub()
    gh.tokenCanWrite = false // permissions.push is still true: the account owns the repo
    await gh.install(page)
    await mockPublished(page, manifestOf([]))
    await page.goto('/')
    await page.getByRole('button', { name: 'Library settings' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Connect' }).click()
    const d = page.getByRole('dialog', { name: 'Connect your library' })
    await d.getByLabel('Repository owner').fill('me')
    await d.getByLabel('Repository name').fill('library')
    await d.getByLabel('Personal access token').fill('github_pat_readonly')
    await d.getByRole('button', { name: 'Connect' }).click()
    await expect(d.getByRole('alert')).toContainText('can’t write to me/library')
  })

  test('explains a rejected token', async ({ page }) => {
    const gh = new FakeGitHub()
    gh.tokenOk = false
    await gh.install(page)
    await mockPublished(page, manifestOf([]))
    await page.goto('/')
    await page.getByRole('button', { name: 'Library settings' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Connect' }).click()
    const d = page.getByRole('dialog', { name: 'Connect your library' })
    await d.getByLabel('Repository owner').fill('me')
    await d.getByLabel('Repository name').fill('library')
    await d.getByLabel('Personal access token').fill('bad')
    await d.getByRole('button', { name: 'Connect' }).click()
    await expect(d.getByRole('alert')).toContainText('wasn’t accepted')
  })

  test('disconnect erases the token from the device', async ({ page }) => {
    const gh = new FakeGitHub()
    await gh.install(page)
    await mockPublished(page, manifestOf([]))
    await page.goto('/')
    await page.getByRole('button', { name: 'Library settings' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Connect' }).click()
    await fillConnect(page)
    const stored = () => page.evaluate(() => new Promise<unknown>((resolve) => {
      const req = indexedDB.open('virtual-library')
      req.onsuccess = () => {
        const g = req.result.transaction('settings').objectStore('settings').get('github')
        g.onsuccess = () => resolve(g.result ?? null)
      }
    }))
    await expect.poll(stored).toMatchObject({ token: 'github_pat_test' })
    await page.getByRole('button', { name: 'Library settings' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Disconnect' }).click()
    await expect(page.getByRole('alert')).toContainText('disconnected')
    await expect.poll(stored).toBeNull()
    await page.reload()
    await page.getByRole('button', { name: 'Library settings' }).click()
    await expect(page.getByRole('dialog', { name: 'Library settings' })).toContainText('isn’t connected')
  })
})
