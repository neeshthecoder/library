import { describe, expect, it, vi } from 'vitest'
import { handle, type Env } from '../../worker/leaderboard/index'

const manifest = { version: 1, books: [{ id: 's6uorwfz7l', title: 'The Pelican Brief' }] }

function setup(store: Record<string, string> = {}) {
  const put = vi.fn(async (k: string, v: string) => {
    store[k] = v
  })
  const env: Env = {
    BOARD: { get: async (k) => store[k] ?? null, put },
    SITE_URL: 'https://example.github.io/library/',
    ALLOWED_ORIGIN: 'https://example.github.io',
  }
  const fetchFn = vi.fn(async () => new Response(JSON.stringify(manifest)))
  return { env, put, fetchFn, store }
}

const put = (path: string, body: unknown) =>
  new Request(`https://w.dev${path}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) })

describe('leaderboard worker', () => {
  it('returns both readers as not started on an empty store', async () => {
    const { env, fetchFn } = setup()
    const res = await handle(new Request('https://w.dev/board'), env, fetchFn)
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://example.github.io')
    expect(await res.json()).toEqual({ A: null, M: null })
  })

  it('saves a valid check-in and returns both records', async () => {
    const { env, fetchFn, put: kvPut } = setup()
    const res = await handle(put('/board/M', { bookId: 's6uorwfz7l', page: 120, pages: 300 }), env, fetchFn)
    expect(res.status).toBe(200)
    const board = await res.json()
    expect(board.A).toBeNull()
    expect(board.M).toMatchObject({ bookId: 's6uorwfz7l', title: 'The Pelican Brief', page: 120, pages: 300, percent: 40 })
    expect(kvPut).toHaveBeenCalledOnce()
    expect(fetchFn).toHaveBeenCalledWith('https://example.github.io/library/library/manifest.json', expect.anything())
  })

  it.each([
    ['unknown reader', '/board/Z', { bookId: 's6uorwfz7l', page: 1, pages: 10 }, 400],
    ['unknown book', '/board/A', { bookId: 'zzzzzzzzzz', page: 1, pages: 10 }, 400],
    ['extra field', '/board/A', { bookId: 's6uorwfz7l', page: 1, pages: 10, title: 'x' }, 400],
    ['bad JSON', '/board/A', '{nope', 400],
    ['body over 1 KB', '/board/A', JSON.stringify({ bookId: 's6uorwfz7l', page: 1, pages: 10, pad: 'x'.repeat(1100) }), 413],
  ])('rejects %s and leaves KV untouched', async (_n, path, body, status) => {
    const { env, fetchFn, put: kvPut } = setup()
    const res = await handle(put(path, body), env, fetchFn)
    expect(res.status).toBe(status)
    expect(kvPut).not.toHaveBeenCalled()
  })

  it('returns 502 when the catalogue cannot be loaded', async () => {
    const { env, put: kvPut } = setup()
    const res = await handle(put('/board/A', { bookId: 's6uorwfz7l', page: 1, pages: 10 }), env, async () => new Response('', { status: 404 }))
    expect(res.status).toBe(502)
    expect(kvPut).not.toHaveBeenCalled()
  })

  it('answers preflight and refuses other methods and paths', async () => {
    const { env, fetchFn } = setup()
    const pre = await handle(new Request('https://w.dev/board/A', { method: 'OPTIONS' }), env, fetchFn)
    expect(pre.status).toBe(204)
    expect(pre.headers.get('Access-Control-Allow-Methods')).toContain('PUT')
    expect((await handle(new Request('https://w.dev/board', { method: 'POST' }), env, fetchFn)).status).toBe(405)
    expect((await handle(new Request('https://w.dev/board/A'), env, fetchFn)).status).toBe(405)
    expect((await handle(new Request('https://w.dev/'), env, fetchFn)).status).toBe(404)
  })
})
