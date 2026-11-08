export const SYNC_INTERVAL = 5 * 60 * 1000

export interface Syncable {
  readonly connected: boolean
  hasUnsyncedPositions(): boolean
  syncPositions(): Promise<void>
}

export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(id: unknown): void
}

/**
 * Debounces reading-position commits: never per page turn; on leaving the
 * reader, on page hide, and at most once per interval while reading.
 */
export class PositionSync {
  #lib: Syncable
  #timer: unknown = null
  #timers: Timers
  #interval: number
  #onError: (e: unknown) => void

  constructor(lib: Syncable, opts: { timers?: Timers; interval?: number; onError?: (e: unknown) => void } = {}) {
    this.#lib = lib
    this.#timers = opts.timers ?? { setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (id) => clearTimeout(id as number) }
    this.#interval = opts.interval ?? SYNC_INTERVAL
    this.#onError = opts.onError ?? (() => undefined)
  }

  /** Call after every locally saved page turn. */
  notePageTurn(): void {
    if (!this.#lib.connected || this.#timer !== null) return
    this.#timer = this.#timers.setTimeout(() => {
      this.#timer = null
      void this.flush()
    }, this.#interval)
  }

  /** Sync now (leaving the reader, page hidden, or startup retry). */
  async flush(): Promise<void> {
    if (this.#timer !== null) {
      this.#timers.clearTimeout(this.#timer)
      this.#timer = null
    }
    if (!this.#lib.connected || !this.#lib.hasUnsyncedPositions()) return
    try {
      await this.#lib.syncPositions()
    } catch (e) {
      this.#onError(e)
    }
  }

  /** Wires page-hide syncing. Returns an unbind function. */
  bindVisibility(doc: Document = document): () => void {
    const onVis = () => doc.visibilityState === 'hidden' && void this.flush()
    doc.addEventListener('visibilitychange', onVis)
    return () => doc.removeEventListener('visibilitychange', onVis)
  }
}
