import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { Cache } from '../../src/storage/cache'
import { GitHub } from '../../src/storage/github'
import { Library } from '../../src/storage/library'
import { addBook, bookPath, emptyManifest, type Book } from '../../src/storage/manifest'
import { PositionSync, SYNC_INTERVAL, type Timers } from '../../src/storage/sync'
import { FakeGitHubApi } from './fake-github'

let n = 0
const book: Book = {
  id: 'a', title: 'A', format: 'pdf', file: bookPath('a', 'pdf'), size: 1, addedAt: '2026-01-01T00:00:00Z',
  length: { pages: 300, estimated: false }, cover: null,
  spine: { source: 'trim', design: 'arch', bg: '#000000', trim: '#ffffff', ink: '#ffffff', h: 0.8, w: 0.15 }, position: null,
}

class FakeTimers implements Timers {
  now = 0
  #q: { at: number; fn: () => void; id: number }[] = []
  #id = 0
  setTimeout(fn: () => void, ms: number) { const id = ++this.#id; this.#q.push({ at: this.now + ms, fn, id }); return id }
  clearTimeout(id: unknown) { this.#q = this.#q.filter((t) => t.id !== id) }
  async advance(ms: number) {
    this.now += ms
    const due = this.#q.filter((t) => t.at <= this.now)
    this.#q = this.#q.filter((t) => t.at > this.now)
    for (const t of due) t.fn()
    await new Promise((r) => setTimeout(r, 20))
  }
}

async function setup(connected = true) {
  const api = new FakeGitHubApi(addBook(emptyManifest(), book))
  const cache = new Cache(`sync-${++n}`)
  if (connected) await cache.putSettings({ owner: 'o', repo: 'r', branch: 'main', token: 't' })
  const fetchImpl = async (u: string, i?: RequestInit) => (u.startsWith('https://api.github.com') ? api.fetch(u, i) : new Response(JSON.stringify(addBook(emptyManifest(), book))))
  const lib = new Library({ cache, fetch: fetchImpl, base: '/', github: (s) => new GitHub(s, fetchImpl, null) })
  await lib.init()
  const timers = new FakeTimers()
  const sync = new PositionSync(lib, { timers })
  let t = Date.parse('2026-02-01T00:00:00Z')
  const turn = async (page: number) => {
    t += 1000
    await lib.savePosition('a', { locator: String(page), fraction: page / 300, label: `${page} of 300`, updatedAt: new Date(t).toISOString() })
    sync.notePageTurn()
  }
  return { api, lib, sync, timers, turn, cache }
}

describe('PositionSync', () => {
  it('commits once for a 30-page session when leaving the reader', async () => {
    const s = await setup()
    for (let p = 1; p <= 30; p++) await s.turn(p)
    expect(s.api.pushes).toEqual([])
    await s.sync.flush()
    expect(s.api.pushes).toEqual(['Update reading positions'])
    expect(s.api.manifest().books[0].position?.locator).toBe('30')
    expect(s.lib.hasUnsyncedPositions()).toBe(false)
    await s.sync.flush()
    expect(s.api.pushes).toHaveLength(1)
  })

  it('syncs at most once per interval while reading', async () => {
    const s = await setup()
    await s.turn(1)
    await s.timers.advance(SYNC_INTERVAL - 1)
    expect(s.api.pushes).toHaveLength(0)
    await s.turn(2)
    await s.timers.advance(1)
    expect(s.api.pushes).toHaveLength(1)
    await s.turn(3)
    await s.timers.advance(SYNC_INTERVAL)
    expect(s.api.pushes).toHaveLength(2)
  })

  it('does nothing on a guest device and stores nothing', async () => {
    const s = await setup(false)
    await s.turn(12)
    await s.sync.flush()
    expect(s.api.pushes).toEqual([])
    expect(await s.cache.getPosition('a')).toBeUndefined()
    expect(s.lib.position('a')?.locator).toBe('12')
  })

  it('retries positions that failed to sync', async () => {
    const s = await setup()
    await s.turn(5)
    s.api.authOk = false
    await s.sync.flush()
    expect(s.lib.hasUnsyncedPositions()).toBe(true)
    s.api.authOk = true
    await s.sync.flush()
    expect(s.api.manifest().books[0].position?.locator).toBe('5')
  })

  it('keeps the newest of local and synced positions', async () => {
    const s = await setup()
    s.api.externalCommit({ ...addBook(emptyManifest(), { ...book, position: { locator: '200', fraction: 0.66, label: '200 of 300', updatedAt: '2026-03-01T00:00:00Z' } }) })
    await s.turn(7) // older (Feb) than the remote position (Mar)
    await s.lib.refresh()
    expect(s.lib.position('a')?.locator).toBe('200')
    await s.sync.flush()
    expect(s.api.manifest().books[0].position?.locator).toBe('200')
  })
})
