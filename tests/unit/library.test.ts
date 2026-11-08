import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { Cache } from '../../src/storage/cache'
import { GitHub, type FetchLike } from '../../src/storage/github'
import { COMMIT_GRACE_MS, Library } from '../../src/storage/library'
import { addBook, bookPath, emptyManifest, type Book, type Manifest } from '../../src/storage/manifest'
import { FakeGitHubApi } from './fake-github'

let n = 0
const book = (id: string): Book => ({
  id, title: `Title ${id}`, format: 'epub', file: bookPath(id, 'epub'), size: 5, addedAt: '2026-01-01T00:00:00Z',
  length: { pages: 10, estimated: true }, cover: null,
  spine: { source: 'trim', design: 'arch', bg: '#000000', trim: '#ffffff', ink: '#ffffff', h: 0.8, w: 0.15 }, position: null,
})
const settings = { owner: 'me', repo: 'lib', branch: 'main', token: 't' }

/** A published site (stale by default) plus an optional GitHub API. */
function setup(opts: { published?: Manifest; api?: FakeGitHubApi; connected?: boolean; files?: Record<string, string> } = {}) {
  const published = { current: opts.published ?? emptyManifest() }
  const requests: string[] = []
  const api = opts.api ?? new FakeGitHubApi()
  const fetchImpl: FetchLike = async (url, init) => {
    requests.push(url)
    if (url.startsWith('https://api.github.com')) return api.fetch(url, init)
    if (url.startsWith('/base/library/manifest.json')) return new Response(JSON.stringify(published.current))
    const name = url.replace('/base/', '')
    if (opts.files?.[name] !== undefined) return new Response(opts.files[name])
    return new Response('nope', { status: 404 })
  }
  const cache = new Cache(`lib-${++n}`)
  const lib = new Library({ cache, fetch: fetchImpl, base: '/base/', github: (s) => new GitHub(s, fetchImpl, null) })
  return { lib, cache, api, published, requests, async init() {
    if (opts.connected) await cache.putSettings(settings)
    await lib.init()
  } }
}

describe('Library loading', () => {
  it('reads the published manifest with a cache-busting query when not connected', async () => {
    const t = setup({ published: addBook(emptyManifest(), book('a')) })
    await t.init()
    expect(t.lib.manifest.books.map((b) => b.id)).toEqual(['a'])
    expect(t.requests[0]).toMatch(/^\/base\/library\/manifest\.json\?t=\d+$/)
  })

  it('reads through the API when connected', async () => {
    const api = new FakeGitHubApi(addBook(emptyManifest(), book('fresh')))
    const t = setup({ api, connected: true })
    await t.init()
    expect(t.lib.manifest.books.map((b) => b.id)).toEqual(['fresh'])
    expect(t.requests.some((r) => r.includes('/contents/library/manifest.json'))).toBe(true)
  })

  it('keeps a just-added book while the published site is stale', async () => {
    const t = setup({ connected: true })
    await t.init()
    await t.lib.add(book('new'), new Blob(['epub']))
    await t.lib.upload('new')
    expect(t.api.file('library/books/new.epub')).toBe('epub')
    // simulate reload on a stale Pages copy: API down, published still empty
    // reload while the API is unreachable and Pages hasn't redeployed yet
    const stale: FetchLike = async (u) => {
      if (u.startsWith('https://api.github.com')) throw new TypeError('offline')
      return u.includes('manifest') ? new Response(JSON.stringify(emptyManifest())) : new Response('', { status: 404 })
    }
    const lib2 = new Library({ cache: t.cache, fetch: stale, base: '/base/', github: (s) => new GitHub(s, stale, null) })
    await lib2.init()
    expect(lib2.manifest.books.map((b) => b.id)).toEqual(['new'])
    expect(await (await lib2.getFile(lib2.book('new')!))!.text()).toBe('epub')
  })

  it('shows a plain error if the manifest is from a newer version', async () => {
    const t = setup({ published: { version: 2 } as unknown as Manifest })
    await t.init()
    expect(t.lib.store.get().error).toMatch(/newer version/)
  })
})

describe('GitHub writes', () => {
  it('commits the file and manifest together in one commit', async () => {
    const t = setup({ connected: true })
    await t.init()
    await t.lib.add(book('a'), new Blob(['bytes']))
    await t.lib.upload('a')
    expect(t.api.pushes).toEqual(['Add "Title a"'])
    expect(t.api.manifest().books.map((b) => b.id)).toEqual(['a'])
    expect(t.api.file('library/books/a.epub')).toBe('bytes')
    expect(t.lib.store.get().pending.find((p) => p.key === 'add:a')?.state).toBe('committed')
  })

  it('forgets committed ops once reflected and past the grace period', async () => {
    let now = Date.parse('2026-01-01T00:00:00Z')
    const api = new FakeGitHubApi()
    const cache = new Cache(`lib-grace-${++n}`)
    await cache.putSettings(settings)
    const lib = new Library({ cache, fetch: api.fetch, base: '/base/', github: (s) => new GitHub(s, api.fetch, null), now: () => new Date(now) })
    await lib.init()
    await lib.add(book('a'), new Blob(['x']))
    await lib.upload('a')
    await lib.refresh()
    expect(lib.store.get().pending).toHaveLength(1)
    now += COMMIT_GRACE_MS + 1
    await lib.refresh()
    expect(lib.store.get().pending).toHaveLength(0)
    expect(lib.manifest.books.map((b) => b.id)).toEqual(['a'])
  })

  it('re-applies the operation after a non-fast-forward conflict', async () => {
    const api = new FakeGitHubApi()
    const t = setup({ api, connected: true })
    await t.init()
    api.externalCommit(addBook(emptyManifest(), book('phone')))
    api.conflictsLeft = 1
    await t.lib.add(book('laptop'), new Blob(['x']))
    await t.lib.upload('laptop')
    expect(api.manifest().books.map((b) => b.id).sort()).toEqual(['laptop', 'phone'])
    expect(api.calls.filter((c) => c === 'POST /git/blobs').length).toBe(3) // file once + manifest twice
  })

  it('marks the upload failed and keeps the book when offline', async () => {
    const api = new FakeGitHubApi()
    const t = setup({ api, connected: true })
    await t.init()
    api.failBlobs = true
    await t.lib.add(book('a'), new Blob(['x']))
    await expect(t.lib.upload('a')).rejects.toThrow()
    expect(t.lib.store.get().pending[0].state).toBe('failed')
    expect(t.lib.manifest.books.map((b) => b.id)).toEqual(['a'])
    api.failBlobs = false
    await t.lib.upload('a')
    expect(api.manifest().books.map((b) => b.id)).toEqual(['a'])
  })

  it('surfaces auth failures', async () => {
    const api = new FakeGitHubApi()
    const gh = new GitHub(settings, api.fetch, null)
    api.authOk = false
    expect(await gh.verify()).toEqual({ ok: false, error: 'auth' })
    api.authOk = true
    api.push = false
    expect((await gh.verify()).error).toBe('no-push')
    api.push = true
    expect(await gh.verify()).toEqual({ ok: true, defaultBranch: 'main' })
    // the account can push, but the fine-grained token lacks Contents: write
    api.tokenCanWrite = false
    expect((await gh.verify()).error).toBe('no-push')
  })

  it('explains a token without write access when uploading', async () => {
    const api = new FakeGitHubApi()
    const t = setup({ api, connected: true })
    await t.init()
    api.tokenCanWrite = false
    await t.lib.add(book('a'), new Blob(['x']))
    await expect(t.lib.upload('a')).rejects.toThrow('This token can’t write to me/lib. Give it “Contents: Read and write” access to this repository, then try again.')
    expect(t.lib.store.get().pending[0].state).toBe('failed')
  })

  it('refuses to add books on a guest device', async () => {
    const t = setup()
    await t.init()
    await expect(t.lib.add(book('a'), new Blob(['x']))).rejects.toThrow(/Connect/)
    expect(await t.cache.fileIds()).toEqual([])
  })
})

describe('duplicate uploads', () => {
  it('never sends cacheable API requests', async () => {
    const seen: (RequestCache | undefined)[] = []
    const api = new FakeGitHubApi()
    const gh = new GitHub(settings, (u, i) => { seen.push(i?.cache); return api.fetch(u, i) }, null)
    await gh.commit((m) => m, [], 'x')
    expect(seen.length).toBeGreaterThan(3)
    expect(seen.every((c) => c === 'no-store')).toBe(true)
  })

  it('shares one upload when Retry is pressed twice', async () => {
    const api = new FakeGitHubApi()
    const t = setup({ api, connected: true })
    await t.init()
    await t.lib.add(book('a'), new Blob(['x']))
    await Promise.all([t.lib.upload('a'), t.lib.upload('a')])
    expect(api.pushes).toEqual(['Add "Title a"'])
    expect(t.lib.store.get().pending[0].state).toBe('committed')
  })

  it('recognizes a book that already landed and stops showing it as not uploaded', async () => {
    const api = new FakeGitHubApi()
    const t = setup({ api, connected: true })
    await t.init()
    await t.lib.add(book('a'), new Blob(['x']))
    // the earlier attempt reported failure, but its commit landed
    await t.cache.putPending({ ...t.lib.store.get().pending[0], state: 'failed', error: 'Update is not a fast forward' })
    api.externalCommit(addBook(emptyManifest(), book('a')))
    const lib2 = new Library({ cache: t.cache, fetch: api.fetch, base: '/base/', github: (s) => new GitHub(s, api.fetch, null) })
    await lib2.init()
    expect(lib2.store.get().pending[0].state).toBe('committed')
    await lib2.upload('a')
    expect(api.pushes).toEqual([]) // nothing re-uploaded
  })
})

describe('deletion', () => {
  it('removes the file and manifest entry in one commit and clears the cache', async () => {
    const api = new FakeGitHubApi()
    const t = setup({ api, connected: true })
    await t.init()
    await t.lib.add(book('a'), new Blob(['x']))
    await t.lib.upload('a')
    await t.lib.savePosition('a', { locator: '2', fraction: 0.2, label: '20%', updatedAt: '2026-01-02T00:00:00Z' })
    await t.lib.delete('a')
    expect(api.pushes.at(-1)).toBe('Delete "Title a"')
    expect(api.file('library/books/a.epub')).toBeUndefined()
    expect(api.manifest().books).toEqual([])
    expect(await t.cache.getFile('a')).toBeNull()
    expect(await t.cache.getPosition('a')).toBeUndefined()
    // a stale published copy that still lists the book doesn't bring it back
    const stale: FetchLike = async (u) => {
      if (u.startsWith('https://api.github.com')) throw new TypeError('offline')
      return new Response(JSON.stringify(addBook(emptyManifest(), book('a'))))
    }
    const lib2 = new Library({ cache: t.cache, fetch: stale, base: '/base/', github: (s) => new GitHub(s, stale, null) })
    await lib2.init()
    expect(lib2.manifest.books).toEqual([])
  })

  it('requires a connection for uploaded books', async () => {
    const t = setup({ published: addBook(emptyManifest(), book('a')) })
    await t.init()
    await expect(t.lib.delete('a')).rejects.toThrow(/Connect/)
  })

  it('drops cached files for books deleted on another device', async () => {
    const api = new FakeGitHubApi(addBook(emptyManifest(), book('a')))
    const t = setup({ api, connected: true, files: { 'library/books/a.epub': 'data' } })
    await t.init()
    await t.lib.getFile(t.lib.book('a')!)
    expect(await t.cache.hasFile('a')).toBe(true)
    api.externalCommit(emptyManifest())
    await t.lib.refresh()
    expect(await t.cache.hasFile('a')).toBe(false)
  })
})

describe('guests', () => {
  const remotePos = { locator: '120', fraction: 0.4, label: '40%', updatedAt: '2026-01-05T00:00:00Z' }

  it('store nothing on the device', async () => {
    const published = addBook(emptyManifest(), { ...book('a'), position: remotePos })
    const t = setup({ published, files: { 'library/books/a.epub': 'data' } })
    await t.init()
    expect(t.lib.isOwner).toBe(false)
    expect(await (await t.lib.getFile(t.lib.book('a')!))!.text()).toBe('data')
    await t.lib.savePosition('a', { locator: '7', fraction: 0.1, label: '10%', updatedAt: '2026-02-01T00:00:00Z' })
    expect(await t.cache.fileIds()).toEqual([])
    expect(await t.cache.allPositions()).toEqual([])
  })

  it('start books at the beginning, keep their place for the tab, and leave the owner’s bookmark alone', async () => {
    const published = addBook(emptyManifest(), { ...book('a'), position: remotePos })
    const t = setup({ published })
    await t.init()
    expect(t.lib.position('a')).toBeNull()
    const mine = { locator: '7', fraction: 0.1, label: '10%', updatedAt: '2026-02-01T00:00:00Z' }
    await t.lib.savePosition('a', mine)
    expect(t.lib.position('a')).toEqual(mine)
    expect(t.lib.manifest.books[0].position).toEqual(remotePos) // the shelf still shows the owner's ribbon
    expect(t.api.pushes).toEqual([])
  })

  it('have leftovers from earlier visits wiped', async () => {
    const t = setup()
    await t.cache.putFile('old', new Blob(['x']))
    await t.cache.putPosition('old', { locator: '1', fraction: 0, label: '0%', updatedAt: '2026-01-01T00:00:00Z' })
    await t.cache.putPending({ key: 'add:old', op: { type: 'add', book: book('old') }, state: 'failed', createdAt: '2026-01-01' })
    await t.init()
    expect(await t.cache.fileIds()).toEqual([])
    expect(await t.cache.allPositions()).toEqual([])
    expect(await t.cache.pending()).toEqual([])
    expect(t.lib.manifest.books).toEqual([])
  })
})

describe('disconnecting', () => {
  it('removes the token and every local copy and position', async () => {
    const api = new FakeGitHubApi(addBook(emptyManifest(), book('a')))
    const t = setup({ api, connected: true, files: { 'library/books/a.epub': 'data' } })
    await t.init()
    await t.lib.getFile(t.lib.book('a')!)
    await t.lib.savePosition('a', { locator: '3', fraction: 0.1, label: '10%', updatedAt: '2026-02-01T00:00:00Z' })
    await t.lib.disconnect()
    expect(await t.cache.getSettings()).toBeNull()
    expect(await t.cache.fileIds()).toEqual([])
    expect(await t.cache.allPositions()).toEqual([])
    expect(t.lib.isOwner).toBe(false)
  })

  it('refuses while a book is waiting to upload', async () => {
    const api = new FakeGitHubApi()
    const t = setup({ api, connected: true })
    await t.init()
    api.failBlobs = true
    await t.lib.add(book('a'), new Blob(['x']))
    await expect(t.lib.upload('a')).rejects.toThrow()
    await expect(t.lib.disconnect()).rejects.toThrow(/Title a/)
    expect(await t.cache.getSettings()).not.toBeNull()
  })
})
