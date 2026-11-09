import { describe, expect, it, vi } from 'vitest'
import { LeaderboardError, getBoard, saveCheckIn } from '../../src/leaderboard/api'

const base = 'https://w.dev'
const rec = { bookId: 's6uorwfz7l', title: 'T', page: 1, pages: 2, percent: 50, updatedAt: 'x' }

describe('leaderboard api', () => {
  it('loads the board', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ A: rec, M: null })))
    expect(await getBoard(base, f as typeof fetch)).toEqual({ A: rec, M: null })
    expect(f).toHaveBeenCalledWith('https://w.dev/board', expect.objectContaining({ credentials: 'omit' }))
  })

  it('saves exactly bookId, page and pages', async () => {
    const f = vi.fn(async (_u: string, _i?: RequestInit) => new Response(JSON.stringify({ A: null, M: rec })))
    await saveCheckIn('M', { bookId: 's6uorwfz7l', page: 1, pages: 2, extra: 1 } as never, base, f as typeof fetch)
    const [url, init] = f.mock.calls[0]
    expect(url).toBe('https://w.dev/board/M')
    expect(init?.method).toBe('PUT')
    expect(JSON.parse(init?.body as string)).toEqual({ bookId: 's6uorwfz7l', page: 1, pages: 2 })
  })

  it('throws a LeaderboardError with the server message on 400', async () => {
    const f = async () => new Response(JSON.stringify({ error: 'Unknown reader.' }), { status: 400 })
    await expect(saveCheckIn('A', { bookId: 'x', page: 1, pages: 2 }, base, f as typeof fetch)).rejects.toMatchObject({
      name: 'LeaderboardError', status: 400, message: 'Couldn’t save. Unknown reader.',
    })
  })

  it('throws a LeaderboardError on network failure', async () => {
    const f = async () => { throw new TypeError('Failed to fetch') }
    const err = await getBoard(base, f as typeof fetch).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LeaderboardError)
    expect((err as LeaderboardError).status).toBeNull()
  })
})
