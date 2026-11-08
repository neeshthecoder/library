import { Store } from '../state/store'
import { Cache, type LocalPosition, type PendingOp, type Settings } from './cache'
import { GitHub, type FetchLike } from './github'
import {
  addBook,
  emptyManifest,
  isReflected,
  merge,
  newerPosition,
  parseManifest,
  removeBook,
  setFinished,
  setPosition,
  totalSize,
  type Book,
  type Manifest,
  type Position,
} from './manifest'

export interface UploadInfo {
  state: 'uploading' | 'failed'
  progress: number
  title: string
}

export interface LibraryState {
  published: Manifest | null
  pending: PendingOp[]
  local: Record<string, LocalPosition>
  settings: Settings | null
  progress: Record<string, number>
  loading: boolean
  error: string | null
}

export interface LibraryDeps {
  cache: Cache
  fetch?: FetchLike
  /** Site base URL, e.g. "/my-repo/". */
  base?: string
  github?: (s: Settings) => GitHub
  now?: () => Date
}

/**
 * Committed changes stay in the local overlay this long, so a reload that falls
 * back to a not-yet-redeployed Pages copy still shows them.
 */
export const COMMIT_GRACE_MS = 15 * 60 * 1000

export class UnsyncedBooksError extends Error {
  constructor(public titles: string[]) {
    super(`Some books on this device aren’t uploaded yet: ${titles.join(', ')}. Upload or delete them before disconnecting.`)
  }
}

export class NotConnectedError extends Error {
  constructor() {
    super('Connect your library to make changes.')
  }
}

/** Merges published manifest, pending operations, and local positions. */
export function effectiveManifest(s: Pick<LibraryState, 'published' | 'pending' | 'local'>): Manifest {
  let m = merge(s.published ?? emptyManifest(), s.pending.map((p) => p.op))
  for (const lp of Object.values(s.local)) m = setPosition(m, lp.id, lp.position, m.updatedAt)
  return m
}

export function uploadsFrom(s: Pick<LibraryState, 'pending' | 'progress'>): Record<string, UploadInfo> {
  const out: Record<string, UploadInfo> = {}
  for (const p of s.pending) {
    if (p.op.type !== 'add' || p.state === 'committed') continue
    out[p.op.book.id] = { state: p.state, progress: s.progress[p.op.book.id] ?? 0, title: p.op.book.title }
  }
  return out
}

export class Library {
  readonly store = new Store<LibraryState>({
    published: null,
    pending: [],
    local: {},
    settings: null,
    progress: {},
    loading: true,
    error: null,
  })
  readonly cache: Cache
  #fetch: FetchLike
  #base: string
  #gh: (s: Settings) => GitHub
  #now: () => Date
  #syncing: Promise<void> | null = null
  #uploading = new Map<string, Promise<void>>()
  /** Guests' reading positions: this tab only, never stored. */
  #guestPositions = new Map<string, Position>()

  constructor(deps: LibraryDeps) {
    this.cache = deps.cache
    this.#fetch = deps.fetch ?? ((u, i) => fetch(u, i))
    this.#base = deps.base ?? '/'
    this.#gh = deps.github ?? ((s) => new GitHub(s, this.#fetch))
    this.#now = deps.now ?? (() => new Date())
  }

  get manifest(): Manifest {
    return effectiveManifest(this.store.get())
  }

  get connected(): boolean {
    return !!this.store.get().settings
  }

  /** The owner is whoever has connected this device with a token that can write. */
  get isOwner(): boolean {
    return this.connected
  }

  book(id: string): Book | undefined {
    return this.manifest.books.find((b) => b.id === id)
  }

  totalBytes(): number {
    return totalSize(this.manifest)
  }

  async init(): Promise<void> {
    const [settings, pending, positions] = await Promise.all([
      this.cache.getSettings(),
      this.cache.pending(),
      this.cache.allPositions(),
    ])
    // an upload interrupted by a reload can't resume mid-request: mark it failed
    for (const p of pending) {
      if (p.state === 'uploading') {
        p.state = 'failed'
        await this.cache.putPending(p)
      }
    }
    if (!settings) {
      // Guests store nothing: wipe anything left from earlier visits.
      await this.cache.clearLocalData()
      this.store.set({ settings: null, pending: [], local: {} })
    } else {
      this.store.set({ settings, pending, local: Object.fromEntries(positions.map((p) => [p.id, p])) })
    }
    await this.refresh()
  }

  /** Fetches the latest manifest (API when connected, else the published site). */
  async refresh(): Promise<void> {
    let published: Manifest | null = this.store.get().published
    let error: string | null = null
    try {
      const s = this.store.get().settings
      published = s ? await this.#gh(s).readManifest().catch(() => this.#fetchPublished()) : await this.#fetchPublished()
    } catch (e) {
      error = e instanceof Error ? e.message : 'The library could not be loaded.'
    }
    this.store.set({ published, loading: false, error })
    if (published) await this.#prune(published)
  }

  async #fetchPublished(): Promise<Manifest> {
    const res = await this.#fetch(`${this.#base}library/manifest.json?t=${this.#now().getTime()}`, { cache: 'no-store' })
    if (res.status === 404) return emptyManifest()
    if (!res.ok) throw new Error('The library could not be loaded.')
    return parseManifest(await res.text())
  }

  /**
   * Drops committed ops that the manifest reflects and that are past the grace
   * period; purges cached files of books no longer in the library.
   */
  async #prune(remote: Manifest): Promise<void> {
    const keep: PendingOp[] = []
    const now = this.#now().getTime()
    for (let p of this.store.get().pending) {
      // an add that failed locally but landed anyway (e.g. a duplicate attempt) is done
      if (p.state === 'failed' && p.op.type === 'add' && isReflected(remote, p.op) && !this.#uploading.has(p.op.book.id)) {
        p = { ...p, state: 'committed', committedAt: now, error: undefined }
        await this.cache.putPending(p)
      }
      const settled = p.state === 'committed' && now - (p.committedAt ?? 0) > COMMIT_GRACE_MS
      if (settled && isReflected(remote, p.op)) await this.cache.deletePending(p.key)
      else keep.push(p)
    }
    this.store.set({ pending: keep })
    const live = new Set(this.manifest.books.map((b) => b.id))
    for (const id of await this.cache.fileIds()) {
      if (!live.has(id)) await this.cache.deleteFile(id)
    }
    const local = { ...this.store.get().local }
    let changed = false
    for (const id of Object.keys(local)) {
      if (!live.has(id)) {
        delete local[id]
        changed = true
        await this.cache.deletePosition(id)
      }
    }
    if (changed) this.store.set({ local })
  }

  #setPending(p: PendingOp): void {
    const pending = this.store.get().pending.filter((x) => x.key !== p.key)
    this.store.set({ pending: [...pending, p].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) })
  }

  #setProgress(id: string, f: number): void {
    this.store.set((s) => ({ progress: { ...s.progress, [id]: f } }))
  }

  /** Adds a book locally right away. Call `upload(id)` afterwards. */
  async add(book: Book, blob: Blob): Promise<void> {
    if (!this.isOwner) throw new NotConnectedError()
    const keep = new Set(this.store.get().pending.flatMap((p) => (p.op.type === 'add' ? [p.op.book.id] : [])))
    await this.cache.putFile(book.id, blob, keep)
    void Cache.requestPersist()
    const p: PendingOp = { key: `add:${book.id}`, op: { type: 'add', book }, state: 'uploading', createdAt: this.#now().toISOString() }
    await this.cache.putPending(p)
    this.#setPending(p)
  }

  /**
   * Uploads (or retries) a locally added book. Concurrent calls for the same
   * book share one upload. Throws NotConnectedError if needed.
   */
  upload(id: string): Promise<void> {
    const running = this.#uploading.get(id)
    if (running) return running
    const task = this.#upload(id).finally(() => this.#uploading.delete(id))
    this.#uploading.set(id, task)
    return task
  }

  async #upload(id: string): Promise<void> {
    const p = this.store.get().pending.find((x) => x.key === `add:${id}`)
    if (!p || p.op.type !== 'add' || p.state === 'committed') return
    const book = p.op.book
    const settings = this.store.get().settings
    const fail = async (error: string) => {
      const failed: PendingOp = { ...p, state: 'failed', error }
      await this.cache.putPending(failed)
      this.#setPending(failed)
    }
    if (!settings) {
      await fail('not-connected')
      throw new NotConnectedError()
    }
    const uploading: PendingOp = { ...p, state: 'uploading', error: undefined }
    this.#setPending(uploading)
    this.#setProgress(id, 0)
    try {
      const blob = await this.cache.getFile(id, false)
      if (!blob) throw new Error('The file is no longer on this device. Add it again.')
      const gh = this.#gh(settings)
      // a previous attempt may have landed even though it reported a failure
      const remote = await gh.readManifest().catch(() => null)
      if (remote?.books.some((b) => b.id === id)) {
        const done: PendingOp = { ...uploading, state: 'committed', committedAt: this.#now().getTime() }
        await this.cache.putPending(done)
        this.#setPending(done)
        this.store.set({ published: remote })
        return
      }
      const sha = await gh.createBlob(blob, (f) => this.#setProgress(id, f * 0.95))
      const res = await gh.commit((m) => addBook(m, book, this.#now().toISOString()), [{ path: book.file, sha }], `Add "${book.title}"`)
      this.#setProgress(id, 1)
      const done: PendingOp = { ...uploading, state: 'committed', commitSha: res.commitSha, committedAt: this.#now().getTime() }
      await this.cache.putPending(done)
      this.#setPending(done)
      this.store.set({ published: res.manifest })
      await this.#prune(res.manifest)
    } catch (e) {
      await fail(e instanceof Error ? e.message : 'Upload failed.')
      throw e
    }
  }

  /** Removes a book everywhere. Requires a connection unless never uploaded. */
  async delete(id: string): Promise<void> {
    const book = this.book(id)
    if (!book) return
    const s = this.store.get()
    const localOnly = !s.published?.books.some((b) => b.id === id)
      && s.pending.some((p) => p.key === `add:${id}` && p.state !== 'committed')
    if (!localOnly) {
      if (!s.settings) throw new NotConnectedError()
      const res = await this.#gh(s.settings).commit(
        (m) => removeBook(m, id, this.#now().toISOString()),
        [{ path: book.file, sha: null }],
        `Delete "${book.title}"`,
      )
      this.store.set({ published: res.manifest })
    }
    for (const p of this.store.get().pending) {
      if (p.key === `add:${id}`) await this.cache.deletePending(p.key)
    }
    this.store.set((st) => ({ pending: st.pending.filter((p) => p.key !== `add:${id}`) }))
    if (!localOnly) {
      // remember the delete so a stale Pages copy doesn't bring the book back
      const del: PendingOp = {
        key: `delete:${id}`, op: { type: 'delete', id }, state: 'committed',
        createdAt: this.#now().toISOString(), committedAt: this.#now().getTime(),
      }
      await this.cache.putPending(del)
      this.#setPending(del)
    }
    await this.cache.deleteFile(id)
    await this.cache.deletePosition(id)
    this.store.set((st) => {
      const local = { ...st.local }
      delete local[id]
      return { local }
    })
  }

  /**
   * Moves a book into (or out of) the Finished section. Shows immediately;
   * one commit records it. Reverts and rethrows if the commit fails.
   */
  async setFinished(id: string, finished: boolean): Promise<void> {
    const s = this.store.get()
    if (!s.settings) throw new NotConnectedError()
    const finishedAt = finished ? this.#now().toISOString() : null
    const key = `finish:${id}`
    const p: PendingOp = { key, op: { type: 'finish', id, finishedAt }, state: 'uploading', createdAt: this.#now().toISOString() }
    const previous = s.pending.find((x) => x.key === key)
    this.#setPending(p)
    try {
      const title = this.book(id)?.title ?? 'book'
      const res = await this.#gh(s.settings).commit(
        (m) => setFinished(m, id, finishedAt, this.#now().toISOString()),
        [],
        finished ? `Finish "${title}"` : `Move "${title}" back to reading`,
      )
      const done: PendingOp = { ...p, state: 'committed', committedAt: this.#now().getTime() }
      await this.cache.putPending(done)
      this.#setPending(done)
      this.store.set({ published: res.manifest })
    } catch (e) {
      this.store.set((st) => ({ pending: [...st.pending.filter((x) => x.key !== key), ...(previous ? [previous] : [])] }))
      throw e
    }
  }

  // Files --------------------------------------------------------------------

  /** Loads a book's file: local cache, then the published site, then the API. */
  async getFile(book: Book): Promise<Blob | null> {
    if (!this.isOwner) {
      // Guests read straight from the site and keep no copy.
      const res = await this.#fetch(`${this.#base}${book.file}`).catch(() => null)
      return res?.ok ? res.blob() : null
    }
    const cached = await this.cache.getFile(book.id)
    if (cached) return cached
    let blob: Blob | null = null
    try {
      const res = await this.#fetch(`${this.#base}${book.file}`)
      if (res.ok) blob = await res.blob()
    } catch { /* fall through */ }
    const s = this.store.get().settings
    if (!blob && s) blob = await this.#gh(s).readFile(book.file).catch(() => null)
    if (blob) await this.cache.putFile(book.id, blob).catch(() => false)
    return blob
  }

  // Positions --------------------------------------------------------------------

  /** Best known position: newest of local and manifest. */
  position(id: string): Position | null {
    if (!this.isOwner) return this.#guestPositions.get(id) ?? null
    const remote = this.store.get().published?.books.find((b) => b.id === id)?.position
    return newerPosition(remote, this.store.get().local[id]?.position)
  }

  async savePosition(id: string, position: Position): Promise<void> {
    if (!this.isOwner) {
      this.#guestPositions.set(id, position)
      return
    }
    const lp: LocalPosition = { id, position, synced: false }
    this.store.set((s) => ({ local: { ...s.local, [id]: lp } }))
    await this.cache.putPosition(id, position, false)
  }

  hasUnsyncedPositions(): boolean {
    return Object.values(this.store.get().local).some((p) => !p.synced)
  }

  /** Commits unsynced local positions in one manifest update. */
  syncPositions(): Promise<void> {
    if (this.#syncing) return this.#syncing
    this.#syncing = this.#sync().finally(() => (this.#syncing = null))
    return this.#syncing
  }

  async #sync(): Promise<void> {
    const s = this.store.get()
    if (!s.settings) return
    const uploaded = new Set(s.published?.books.map((b) => b.id) ?? [])
    const dirty: Record<string, Position> = {}
    for (const lp of Object.values(s.local)) {
      if (lp.synced || !uploaded.has(lp.id)) continue
      const remote = s.published?.books.find((b) => b.id === lp.id)?.position
      if (remote && Date.parse(remote.updatedAt) >= Date.parse(lp.position.updatedAt)) continue
      dirty[lp.id] = lp.position
    }
    if (!Object.keys(dirty).length) {
      await this.#markSynced(Object.fromEntries(Object.values(s.local).filter((p) => !p.synced && uploaded.has(p.id)).map((p) => [p.id, p.position])))
      return
    }
    const res = await this.#gh(s.settings).commit(
      (m) => Object.entries(dirty).reduce((acc, [id, p]) => setPosition(acc, id, p, this.#now().toISOString()), m),
      [],
      'Update reading positions',
    )
    this.store.set({ published: res.manifest })
    await this.#markSynced(dirty)
  }

  async #markSynced(positions: Record<string, Position>): Promise<void> {
    if (!Object.keys(positions).length) return
    await this.cache.markSynced(positions)
    this.store.set((st) => {
      const local = { ...st.local }
      for (const [id, p] of Object.entries(positions)) {
        if (local[id]?.position.updatedAt === p.updatedAt) local[id] = { ...local[id], synced: true }
      }
      return { local }
    })
  }

  // Connection -----------------------------------------------------------------

  async connect(settings: Settings): Promise<void> {
    this.#guestPositions.clear()
    await this.cache.putSettings(settings)
    this.store.set({ settings })
    await this.refresh()
  }

  /**
   * Turns this device back into a guest: removes the token and every local
   * copy and position. Sync positions first. Refuses while books are waiting
   * to upload, since they would be lost.
   */
  async disconnect(): Promise<void> {
    const waiting = this.store.get().pending.filter((p) => p.op.type === 'add' && p.state !== 'committed')
    if (waiting.length) throw new UnsyncedBooksError(waiting.map((p) => (p.op.type === 'add' ? p.op.book.title : '')))
    await this.cache.clearSettings()
    await this.cache.clearLocalData()
    this.#guestPositions.clear()
    this.store.set({ settings: null, pending: [], local: {} })
  }
}
