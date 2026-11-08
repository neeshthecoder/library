import type { Settings } from './cache'
import { emptyManifest, MANIFEST_PATH, parseManifest, type Manifest } from './manifest'

export const API = 'https://api.github.com'

export class GitHubError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}
export class AuthError extends GitHubError {}
export class ConflictError extends GitHubError {}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>
export type UploadFn = (url: string, headers: Record<string, string>, body: Blob, onProgress: (f: number) => void) => Promise<{ status: number; text: string }>

export interface VerifyResult {
  ok: boolean
  error?: 'auth' | 'not-found' | 'no-push' | 'network'
  defaultBranch?: string
}

export interface TreeEntry {
  path: string
  /** null deletes the path. */
  sha: string | null
}

export interface CommitResult {
  commitSha: string
  manifest: Manifest
}

/** Reads a Blob as base64 without blocking the main thread. */
export async function blobToBase64(blob: Blob): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    const url = await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = () => reject(r.error)
      r.readAsDataURL(blob)
    })
    return url.slice(url.indexOf(',') + 1)
  }
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let out = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) out += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  return btoa(out)
}

const xhrUpload: UploadFn = (url, headers, body, onProgress) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total)
    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText })
    xhr.onerror = () => reject(new GitHubError(0, 'The network request failed.'))
    xhr.send(body)
  })

const enc = (p: string) => p.split('/').map(encodeURIComponent).join('/')

export class GitHub {
  #s: Settings
  #fetch: FetchLike
  #upload: UploadFn | null

  constructor(settings: Settings, fetchImpl: FetchLike = (u, i) => fetch(u, i), upload: UploadFn | null = typeof XMLHttpRequest !== 'undefined' ? xhrUpload : null) {
    this.#s = settings
    this.#fetch = fetchImpl
    this.#upload = upload
  }

  get settings(): Settings {
    return this.#s
  }

  #headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${this.#s.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...extra,
    }
  }

  #repo(path: string) {
    return `${API}/repos/${encodeURIComponent(this.#s.owner)}/${encodeURIComponent(this.#s.repo)}${path}`
  }

  async #json<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response
    try {
      res = await this.#fetch(this.#repo(path), {
        method,
        headers: this.#headers(body ? { 'Content-Type': 'application/json' } : {}),
        body: body ? JSON.stringify(body) : undefined,
        // GitHub sends max-age=60; a cached ref would make every retry stale
        cache: 'no-store',
      })
    } catch {
      throw new GitHubError(0, 'The network request failed.')
    }
    return this.#handle<T>(res.status, await res.text(), method, path)
  }

  #handle<T>(status: number, text: string, method: string, path: string): T {
    if (status >= 200 && status < 300) return (text ? JSON.parse(text) : {}) as T
    let msg = text
    try { msg = JSON.parse(text).message ?? text } catch { /* not JSON */ }
    if (status === 403 && /not accessible by (personal access|integration)/i.test(msg)) {
      throw new AuthError(status, `This token can’t write to ${this.#s.owner}/${this.#s.repo}. Give it “Contents: Read and write” access to this repository, then try again.`)
    }
    if (status === 401 || (status === 403 && !/rate limit/i.test(msg))) throw new AuthError(status, msg)
    if (status === 409 || (status === 422 && method === 'PATCH' && path.includes('/git/refs/'))) throw new ConflictError(status, msg)
    throw new GitHubError(status, msg)
  }

  /**
   * Checks the token can write to the repository. `permissions.push` on the
   * repo reflects the *account's* access, not a fine-grained token's, so we
   * also create a tiny unreferenced blob: that needs Contents: write and
   * changes nothing visible (git garbage-collects it).
   */
  async verify(): Promise<VerifyResult> {
    let repo: { default_branch: string; permissions?: { push?: boolean } }
    try {
      repo = await this.#json('GET', '')
    } catch (e) {
      if (e instanceof AuthError) return { ok: false, error: 'auth' }
      if (e instanceof GitHubError && e.status === 404) return { ok: false, error: 'not-found' }
      return { ok: false, error: 'network' }
    }
    if (!repo.permissions?.push) return { ok: false, error: 'no-push', defaultBranch: repo.default_branch }
    try {
      await this.#json('POST', '/git/blobs', { content: 'bookshelf write check', encoding: 'utf-8' })
    } catch (e) {
      if (e instanceof AuthError || (e instanceof GitHubError && (e.status === 404 || e.status === 403))) {
        return { ok: false, error: 'no-push', defaultBranch: repo.default_branch }
      }
      return { ok: false, error: 'network' }
    }
    return { ok: true, defaultBranch: repo.default_branch }
  }

  async getHead(): Promise<{ commitSha: string; treeSha: string }> {
    const ref = await this.#json<{ object: { sha: string } }>('GET', `/git/ref/heads/${enc(this.#s.branch)}`)
    const commit = await this.#json<{ tree: { sha: string } }>('GET', `/git/commits/${ref.object.sha}`)
    return { commitSha: ref.object.sha, treeSha: commit.tree.sha }
  }

  async #raw(path: string, ref: string): Promise<Response | null> {
    let res: Response
    try {
      res = await this.#fetch(this.#repo(`/contents/${enc(path)}?ref=${encodeURIComponent(ref)}`), {
        headers: this.#headers({ Accept: 'application/vnd.github.raw+json' }),
        cache: 'no-store',
      })
    } catch {
      throw new GitHubError(0, 'The network request failed.')
    }
    if (res.status === 404) return null
    if (!res.ok) this.#handle(res.status, await res.text(), 'GET', path)
    return res
  }

  async readManifest(ref = this.#s.branch): Promise<Manifest> {
    const res = await this.#raw(MANIFEST_PATH, ref)
    return res ? parseManifest(await res.text()) : emptyManifest()
  }

  async readFile(path: string, ref = this.#s.branch): Promise<Blob | null> {
    const res = await this.#raw(path, ref)
    return res ? res.blob() : null
  }

  async createBlob(content: Blob | string, onProgress?: (f: number) => void): Promise<string> {
    if (typeof content === 'string') {
      const r = await this.#json<{ sha: string }>('POST', '/git/blobs', { content, encoding: 'utf-8' })
      return r.sha
    }
    const b64 = await blobToBase64(content)
    if (this.#upload && onProgress) {
      const body = new Blob(['{"encoding":"base64","content":"', b64, '"}'], { type: 'application/json' })
      let res
      try {
        res = await this.#upload(this.#repo('/git/blobs'), this.#headers({ 'Content-Type': 'application/json' }), body, onProgress)
      } catch (e) {
        throw e instanceof GitHubError ? e : new GitHubError(0, 'The network request failed.')
      }
      return this.#handle<{ sha: string }>(res.status, res.text, 'POST', '/git/blobs').sha
    }
    const r = await this.#json<{ sha: string }>('POST', '/git/blobs', { content: b64, encoding: 'base64' })
    onProgress?.(1)
    return r.sha
  }

  /**
   * Commits a manifest change, plus optional file entries, atomically. On a
   * non-fast-forward ref update it re-reads the head and re-applies `build` to
   * the newer manifest, up to `retries` times.
   */
  async commit(
    build: (m: Manifest) => Manifest,
    files: TreeEntry[],
    message: string,
    retries = 3,
  ): Promise<CommitResult> {
    for (let attempt = 0; ; attempt++) {
      const head = await this.getHead()
      const current = await this.readManifest(head.commitSha)
      const next = build(current)
      const manifestSha = await this.createBlob(JSON.stringify(next, null, 2) + '\n')
      const tree = await this.#json<{ sha: string }>('POST', '/git/trees', {
        base_tree: head.treeSha,
        tree: [
          ...files.map((f) => ({ path: f.path, mode: '100644', type: 'blob', sha: f.sha })),
          { path: MANIFEST_PATH, mode: '100644', type: 'blob', sha: manifestSha },
        ],
      })
      const commit = await this.#json<{ sha: string }>('POST', '/git/commits', {
        message,
        tree: tree.sha,
        parents: [head.commitSha],
      })
      try {
        await this.#json('PATCH', `/git/refs/heads/${enc(this.#s.branch)}`, { sha: commit.sha, force: false })
        return { commitSha: commit.sha, manifest: next }
      } catch (e) {
        if (e instanceof ConflictError && attempt < retries) {
          await new Promise((r) => setTimeout(r, 300 * (attempt + 1)))
          continue
        }
        throw e
      }
    }
  }
}

/** Guesses owner/repo from a github.io address. */
export function repoFromLocation(loc: { hostname: string; pathname: string }): { owner: string; repo: string } {
  const m = /^([a-z0-9-]+)\.github\.io$/i.exec(loc.hostname)
  if (!m) return { owner: '', repo: '' }
  const first = loc.pathname.split('/').filter(Boolean)[0]
  return { owner: m[1], repo: first ?? `${m[1]}.github.io` }
}
