/**
 * Ranking and nudges for the two-reader leaderboard. Pure, so it's easy to test.
 */

import type { Board, Reader, ReaderRecord } from '../../worker/leaderboard/validate'

export type { Board, Reader, ReaderRecord }

export interface BoardRow {
  reader: Reader
  record: ReaderRecord | null
  /** Percent complete; a reader who hasn't checked in counts as 0. */
  percent: number
}

export interface Ranking {
  rows: BoardRow[]
  /** The reader who's behind, or null when it's a tie. */
  behind: Reader | null
  tie: boolean
}

/** Readers this close (in percentage points) are tied. */
export const TIE_POINTS = 1

export const NUDGES = [
  'Keep up the pace, toots!',
  "The book won't read itself, sweet pea.",
  'Chop chop, bookworm.',
  'Less scrolling, more page-turning.',
  'Those pages are getting lonely.',
  "Pick up the pace, slowpoke. I'm waiting.",
  'Is that a bookmark or a fossil?',
  'Snack, sit, read. You know the drill.',
  'Tick tock, chapter clock.',
  'The squirrel reads faster than this.',
]

export const TIE_LINE = 'Neck and neck! Nobody blink.'

export function rankBoard(board: Board): Ranking {
  const rows: BoardRow[] = (['A', 'M'] as const).map((reader) => ({
    reader,
    record: board[reader],
    percent: board[reader]?.percent ?? 0,
  }))
  rows.sort((x, y) => y.percent - x.percent)
  const tie = rows[0].percent - rows[1].percent <= TIE_POINTS
  return { rows, behind: tie ? null : rows[1].reader, tie }
}

export function pickNudge(random: () => number = Math.random): string {
  return NUDGES[Math.min(NUDGES.length - 1, Math.floor(random() * NUDGES.length))]
}
