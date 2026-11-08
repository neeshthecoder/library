import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Op, Position } from './manifest'

export interface Settings {
  token: string
  owner: string
  repo: string
  branch: string
}

export type PendingState = 'uploading' | 'committed' | 'failed'
export interface PendingOp {
  key: string
  op: Op
  state: PendingState
  createdAt: string
  commitSha?: string
  /** ms timestamp when the commit landed. */
  committedAt?: number
  error?: string
}

export interface CachedFile {
  id: string
  blob: Blob
  size: number
  lastOpenedAt: number
}

export interface LocalPosition {
  id: string
  position: Position
  /** False until the position is committed to the manifest. */
  synced: boolean
}

interface LibraryDB extends DBSchema {
  files: { key: string; value: CachedFile; indexes: { lastOpenedAt: number } }
  positions: { key: string; value: LocalPosition }
  pending: { key: string; value: PendingOp }
  settings: { key: string; value: Settings }
}

const DB_NAME = 'virtual-library'

export const isQuotaError = (e: unknown) =>
  e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)

export class Cache {
  #db: Promise<IDBPDatabase<LibraryDB>>
  #now: () => number

  constructor(name = DB_NAME, now: () => number = Date.now) {
    this.#now = now
    this.#db = openDB<LibraryDB>(name, 1, {
      upgrade(db) {
        db.createObjectStore('files', { keyPath: 'id' }).createIndex('lastOpenedAt', 'lastOpenedAt')
        db.createObjectStore('positions', { keyPath: 'id' })
        db.createObjectStore('pending', { keyPath: 'key' })
        db.createObjectStore('settings')
      },
    })
  }

  /** Asks the browser not to evict our storage. Best effort. */
  static async requestPersist(): Promise<boolean> {
    try {
      return (await navigator.storage?.persist?.()) ?? false
    } catch {
      return false
    }
  }

  // Files ------------------------------------------------------------------

  async getFile(id: string, touch = true): Promise<Blob | null> {
    const db = await this.#db
    const rec = await db.get('files', id)
    if (!rec) return null
    if (touch) {
      rec.lastOpenedAt = this.#now()
      await db.put('files', rec).catch(() => undefined)
    }
    return rec.blob
  }

  async hasFile(id: string): Promise<boolean> {
    return (await (await this.#db).getKey('files', id)) !== undefined
  }

  /**
   * Stores a file. On quota errors, evicts the least recently opened files
   * (never those in `keep`) and retries. Returns false if it could not fit.
   */
  async putFile(id: string, blob: Blob, keep: ReadonlySet<string> = new Set()): Promise<boolean> {
    const db = await this.#db
    const rec: CachedFile = { id, blob, size: blob.size, lastOpenedAt: this.#now() }
    for (;;) {
      try {
        await db.put('files', rec)
        return true
      } catch (e) {
        if (!isQuotaError(e)) throw e
        const evicted = await this.evictOldest(new Set([...keep, id]))
        if (!evicted) return false
      }
    }
  }

  /** Removes the least recently opened file not in `keep`. Returns its id. */
  async evictOldest(keep: ReadonlySet<string>): Promise<string | null> {
    const db = await this.#db
    let cursor = await db.transaction('files').store.index('lastOpenedAt').openCursor()
    while (cursor) {
      if (!keep.has(cursor.value.id)) {
        const id = cursor.value.id
        await db.delete('files', id)
        return id
      }
      cursor = await cursor.continue()
    }
    return null
  }

  async deleteFile(id: string): Promise<void> {
    await (await this.#db).delete('files', id)
  }

  async fileIds(): Promise<string[]> {
    return (await this.#db).getAllKeys('files')
  }

  // Positions ----------------------------------------------------------------

  async getPosition(id: string): Promise<LocalPosition | undefined> {
    return (await this.#db).get('positions', id)
  }

  async allPositions(): Promise<LocalPosition[]> {
    return (await this.#db).getAll('positions')
  }

  async putPosition(id: string, position: Position, synced = false): Promise<void> {
    await (await this.#db).put('positions', { id, position, synced })
  }

  async markSynced(positions: Record<string, Position>): Promise<void> {
    const db = await this.#db
    for (const [id, p] of Object.entries(positions)) {
      const cur = await db.get('positions', id)
      // only mark synced if no newer local position arrived meanwhile
      if (cur && cur.position.updatedAt === p.updatedAt) await db.put('positions', { ...cur, synced: true })
    }
  }

  async deletePosition(id: string): Promise<void> {
    await (await this.#db).delete('positions', id)
  }

  // Pending ops ----------------------------------------------------------------

  async pending(): Promise<PendingOp[]> {
    const all = await (await this.#db).getAll('pending')
    return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  async putPending(p: PendingOp): Promise<void> {
    await (await this.#db).put('pending', p)
  }

  async deletePending(key: string): Promise<void> {
    await (await this.#db).delete('pending', key)
  }

  // Settings ---------------------------------------------------------------------

  async getSettings(): Promise<Settings | null> {
    return (await (await this.#db).get('settings', 'github')) ?? null
  }

  async putSettings(s: Settings): Promise<void> {
    await (await this.#db).put('settings', s, 'github')
  }

  async clearSettings(): Promise<void> {
    await (await this.#db).delete('settings', 'github')
  }
}
