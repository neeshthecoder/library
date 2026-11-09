/**
 * Talks to the leaderboard's progress store (worker/leaderboard). The store is
 * the only place the check-in writes to.
 */

import type { Board, Reader } from './board'
import { LEADERBOARD_URL } from './config'

export interface CheckIn {
  bookId: string
  page: number
  pages: number
}

/** Thrown when the store can't be reached or rejects a request. */
export class LeaderboardError extends Error {
  constructor(message: string, readonly status: number | null) {
    super(message)
    this.name = 'LeaderboardError'
  }
}

type Fetch = typeof fetch

async function call(url: string, init: RequestInit | undefined, fetchFn: Fetch, failed: string): Promise<Board> {
  let res: Response
  try {
    res = await fetchFn(url, { ...init, cache: 'no-store', credentials: 'omit' })
  } catch {
    throw new LeaderboardError('Couldn’t reach the leaderboard. Check your connection and try again.', null)
  }
  if (!res.ok) {
    const detail = await res.json().then((d: { error?: unknown }) => (typeof d.error === 'string' ? d.error : ''), () => '')
    throw new LeaderboardError(`${failed} ${detail}`.trim(), res.status)
  }
  const data = (await res.json()) as Partial<Board>
  return { A: data.A ?? null, M: data.M ?? null }
}

export function getBoard(base = LEADERBOARD_URL, fetchFn: Fetch = fetch): Promise<Board> {
  return call(`${base}/board`, undefined, fetchFn, 'Couldn’t load the leaderboard.')
}

export function saveCheckIn(reader: Reader, checkIn: CheckIn, base = LEADERBOARD_URL, fetchFn: Fetch = fetch): Promise<Board> {
  const { bookId, page, pages } = checkIn
  return call(
    `${base}/board/${reader}`,
    { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookId, page, pages }) },
    fetchFn,
    'Couldn’t save.',
  )
}
