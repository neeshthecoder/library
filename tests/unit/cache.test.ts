import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { Cache } from '../../src/storage/cache'

let n = 0
const fresh = (now = () => Date.now()) => new Cache(`test-${++n}`, now)
const blob = (s: string) => new Blob([s])

describe('Cache', () => {
  it('stores and reads files', async () => {
    const c = fresh()
    await c.putFile('a', blob('hello'))
    expect(await (await c.getFile('a'))!.text()).toBe('hello')
    expect(await c.hasFile('a')).toBe(true)
    await c.deleteFile('a')
    expect(await c.getFile('a')).toBeNull()
  })

  it('evicts the least recently opened file first', async () => {
    let t = 0
    const c = fresh(() => ++t)
    await c.putFile('a', blob('1'))
    await c.putFile('b', blob('2'))
    await c.putFile('c', blob('3'))
    await c.getFile('a') // a is now most recent
    expect(await c.evictOldest(new Set())).toBe('b')
    expect(await c.evictOldest(new Set(['c']))).toBe('a')
    expect(await c.fileIds()).toEqual(['c'])
  })

  it('retries after evicting on quota errors', async () => {
    let t = 0
    const c = fresh(() => ++t)
    await c.putFile('old', blob('x'))
    await c.putFile('keep', blob('y'))
    // Simulate a quota error on the first write of "new".
    let failed = false
    const origPut = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      if (!failed && (value as { id?: string })?.id === 'new') {
        failed = true
        throw new DOMException('full', 'QuotaExceededError')
      }
      return origPut.call(this, value, key)
    }
    try {
      expect(await c.putFile('new', blob('z'), new Set(['keep']))).toBe(true)
    } finally {
      IDBObjectStore.prototype.put = origPut
    }
    expect(failed).toBe(true)
    expect((await c.fileIds()).sort()).toEqual(['keep', 'new'])
  })

  it('tracks positions and marks them synced only if unchanged', async () => {
    const c = fresh()
    const p1 = { locator: '3', fraction: 0.1, label: '3 of 30', updatedAt: '2026-01-01T00:00:00Z' }
    const p2 = { ...p1, locator: '5', updatedAt: '2026-01-01T00:01:00Z' }
    await c.putPosition('a', p1)
    await c.putPosition('a', p2)
    await c.markSynced({ a: p1 })
    expect((await c.getPosition('a'))!.synced).toBe(false)
    await c.markSynced({ a: p2 })
    expect((await c.getPosition('a'))!.synced).toBe(true)
  })

  it('stores settings and pending ops', async () => {
    const c = fresh()
    await c.putSettings({ owner: 'o', repo: 'r', branch: 'main', token: 't' })
    expect((await c.getSettings())!.repo).toBe('r')
    await c.clearSettings()
    expect(await c.getSettings()).toBeNull()
    await c.putPending({ key: 'add:b', op: { type: 'delete', id: 'b' }, state: 'failed', createdAt: '2026-01-02' })
    await c.putPending({ key: 'add:a', op: { type: 'delete', id: 'a' }, state: 'failed', createdAt: '2026-01-01' })
    expect((await c.pending()).map((p) => p.key)).toEqual(['add:a', 'add:b'])
  })
})
