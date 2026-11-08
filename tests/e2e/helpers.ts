import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test as base, expect } from '@playwright/test'
import type { Page, Route } from '@playwright/test'
import type { Book, Manifest } from '../../src/storage/manifest'

export const FIXTURES = fileURLToPath(new URL('../fixtures', import.meta.url))
export const fixture = (name: string) => readFileSync(join(FIXTURES, name))

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, accept, x-github-api-version',
  'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
}

export function makeBook(over: Partial<Book> & { id: string }): Book {
  const format = over.format ?? 'epub'
  return {
    title: `Book ${over.id}`,
    format,
    file: `library/books/${over.id}.${format}`,
    size: 6934,
    addedAt: new Date(Date.UTC(2026, 0, 1) + parseInt(over.id.replace(/\D/g, '') || '0', 10) * 86400000).toISOString(),
    length: { pages: 200, estimated: true },
    cover: null,
    spine: { source: 'trim', design: 'arch', bg: '#24413a', trim: '#e0864a', ink: '#e0864a', h: 0.9, w: 0.16 },
    position: null,
    ...over,
  }
}

export const manifestOf = (books: Book[]): Manifest => ({ version: 1, updatedAt: new Date().toISOString(), books })

/** Serves a published library (manifest + files) from the Pages origin. */
export async function mockPublished(page: Page, manifest: Manifest | (() => Manifest), files: Record<string, Buffer> = {}) {
  await page.route('**/library/manifest.json*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(typeof manifest === 'function' ? manifest() : manifest) }),
  )
  await page.route('**/library/books/*', (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop()!
    const body = files[name]
    return body ? route.fulfill({ status: 200, body, contentType: 'application/octet-stream' }) : route.fulfill({ status: 404, body: 'not found' })
  })
}

interface Commit { sha: string; tree: Record<string, Buffer>; parent: string | null; message: string }

/** An in-memory GitHub repository behind api.github.com. */
export class FakeGitHub {
  blobs = new Map<string, Buffer>()
  commits = new Map<string, Commit>()
  head: string
  pushes: string[] = []
  permissions = { push: true }
  tokenOk = true
  /** Make the next N ref updates fail as non-fast-forward. */
  conflictsLeft = 0
  /** Fail blob uploads (simulate offline). */
  offline = false
  /** Fine-grained token without Contents: write. */
  tokenCanWrite = true
  #n = 0

  constructor(initial: Manifest = manifestOf([])) {
    this.head = this.#commit({ 'library/manifest.json': Buffer.from(JSON.stringify(initial)) }, null, 'init')
  }

  #sha() { return (++this.#n).toString(16).padStart(40, '0') }
  #commit(tree: Record<string, Buffer>, parent: string | null, message: string) {
    const sha = this.#sha()
    this.commits.set(sha, { sha, tree, parent, message })
    return sha
  }

  manifest(sha = this.head): Manifest {
    return JSON.parse(this.commits.get(sha)!.tree['library/manifest.json'].toString())
  }

  /** Another device commits a change directly. */
  externalCommit(m: Manifest, message = 'external') {
    const tree = { ...this.commits.get(this.head)!.tree, 'library/manifest.json': Buffer.from(JSON.stringify(m)) }
    this.head = this.#commit(tree, this.head, message)
  }

  file(path: string) { return this.commits.get(this.head)!.tree[path] }

  async install(page: Page) {
    await page.route('https://api.github.com/**', (route) => this.#handle(route))
  }

  async #handle(route: Route) {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    const url = new URL(req.url())
    const p = url.pathname.replace(/^\/repos\/[^/]+\/[^/]+/, '')
    const json = (status: number, body: unknown) => route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (!this.tokenOk) return json(401, { message: 'Bad credentials' })
    if (p === '' && req.method() === 'GET') return json(200, { default_branch: 'main', permissions: this.permissions })
    if (p === '/git/ref/heads/main') return json(200, { object: { sha: this.head } })
    let m
    if ((m = /^\/git\/commits\/(\w+)$/.exec(p))) return json(200, { tree: { sha: `tree-${m[1]}` } })
    if ((m = /^\/contents\/(.+)$/.exec(p))) {
      const ref = url.searchParams.get('ref') ?? 'main'
      const sha = ref === 'main' ? this.head : ref
      const body = this.commits.get(sha)?.tree[decodeURIComponent(m[1])]
      return body ? route.fulfill({ status: 200, headers: CORS, body }) : json(404, { message: 'Not Found' })
    }
    if (p === '/git/blobs' && req.method() === 'POST') {
      if (this.offline) return route.abort('internetdisconnected')
      if (!this.tokenCanWrite) return json(403, { message: 'Resource not accessible by personal access token' })
      const { content, encoding } = JSON.parse(req.postData() ?? '{}')
      const sha = this.#sha()
      this.blobs.set(sha, Buffer.from(content, encoding === 'base64' ? 'base64' : 'utf8'))
      return json(201, { sha })
    }
    if (p === '/git/trees' && req.method() === 'POST') {
      const { base_tree, tree } = JSON.parse(req.postData() ?? '{}')
      const base = { ...this.commits.get(base_tree.replace('tree-', ''))!.tree }
      for (const e of tree) {
        if (e.sha === null) delete base[e.path]
        else base[e.path] = this.blobs.get(e.sha)!
      }
      const sha = this.#sha()
      this.#trees.set(sha, base)
      return json(201, { sha })
    }
    if (p === '/git/commits' && req.method() === 'POST') {
      const { tree, parents, message } = JSON.parse(req.postData() ?? '{}')
      const sha = this.#sha()
      this.commits.set(sha, { sha, tree: this.#trees.get(tree)!, parent: parents[0], message })
      return json(201, { sha })
    }
    if (p === '/git/refs/heads/main' && req.method() === 'PATCH') {
      const { sha } = JSON.parse(req.postData() ?? '{}')
      if (this.conflictsLeft > 0 || this.commits.get(sha)!.parent !== this.head) {
        this.conflictsLeft = Math.max(0, this.conflictsLeft - 1)
        return json(422, { message: 'Update is not a fast forward' })
      }
      this.head = sha
      this.pushes.push(this.commits.get(sha)!.message)
      return json(200, { object: { sha } })
    }
    return json(404, { message: `Unhandled ${req.method()} ${p}` })
  }
  #trees = new Map<string, Record<string, Buffer>>()
}

/** Signs in (connects the library) through the UI. */
export async function connect(page: Page) {
  await page.getByRole('button', { name: 'Sign in' }).click()
  await fillConnect(page)
  // the token is saved once the owner controls appear
  await expect(page.getByRole('button', { name: 'Library settings' })).toBeVisible()
}

/**
 * Opens the site as the signed-in owner: a fake repo holding `books`, the same
 * books published on Pages, then signs in. Returns the fake repo.
 */
export async function asOwner(page: Page, books: Book[] = [], files: Record<string, Buffer> = {}, path = '/') {
  const gh = new FakeGitHub(manifestOf(books))
  await gh.install(page)
  await mockPublished(page, () => gh.manifest(), files)
  await page.goto('/')
  await connect(page)
  if (path !== '/') await page.goto(path)
  return gh
}

export async function fillConnect(page: Page) {
  const d = page.getByRole('dialog', { name: 'Connect your library' })
  await d.getByLabel('Repository owner').fill('me')
  await d.getByLabel('Repository name').fill('library')
  await d.getByLabel('Personal access token').fill('github_pat_test')
  await d.getByRole('button', { name: 'Connect' }).click()
  await d.waitFor({ state: 'detached' })
}

/** Drops files onto the window via synthetic drag events. */
export async function dropFiles(page: Page, files: { name: string; buffer: Buffer; mimeType?: string }[]) {
  const payload = files.map((f) => ({ name: f.name, data: f.buffer.toString('base64'), type: f.mimeType ?? '' }))
  const dt = await page.evaluateHandle((items) => {
    const dt = new DataTransfer()
    for (const it of items) {
      const bytes = Uint8Array.from(atob(it.data), (c) => c.charCodeAt(0))
      dt.items.add(new File([bytes], it.name, { type: it.type }))
    }
    return dt
  }, payload)
  await page.dispatchEvent('body', 'dragenter', { dataTransfer: dt })
  await page.dispatchEvent('body', 'dragover', { dataTransfer: dt })
  await page.dispatchEvent('body', 'drop', { dataTransfer: dt })
}

/** Presses an arrow key n times, waiting for each page turn to land. */
export async function turnPages(page: Page, n: number, key: 'ArrowRight' | 'ArrowLeft' = 'ArrowRight') {
  const label = page.locator('.reader-progress')
  for (let i = 0; i < n; i++) {
    const before = await label.textContent()
    await page.keyboard.press(key)
    await (await import('@playwright/test')).expect.poll(() => label.textContent(), { timeout: 5000 }).not.toBe(before)
  }
}

// --- Time of day ------------------------------------------------------------
export const NOON = new Date(2026, 10, 8, 12, 0, 0)
export const TEN_PM = new Date(2026, 10, 8, 22, 0, 0)

/** Starts the page clock at noon (day) or 10 PM (night); time then flows normally. */
export async function setTheme(page: Page, theme: 'day' | 'night') {
  await page.clock.install({ time: theme === 'day' ? NOON : TEN_PM })
}

/** Tests run in the day theme unless they opt into `theme: 'night'`. */
export const test = base.extend<{ theme: 'day' | 'night' }>({
  theme: ['day', { option: true }],
  page: async ({ page, theme }, use) => {
    await setTheme(page, theme)
    await use(page)
  },
})
export { expect }
