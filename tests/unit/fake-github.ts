import type { FetchLike } from '../../src/storage/github'
import { emptyManifest, type Manifest } from '../../src/storage/manifest'

interface Commit { tree: Record<string, string>; parent: string | null; message: string }

/** In-memory GitHub API for unit tests. Files are stored as strings. */
export class FakeGitHubApi {
  blobs = new Map<string, string>()
  commits = new Map<string, Commit>()
  trees = new Map<string, Record<string, string>>()
  head: string
  pushes: string[] = []
  calls: string[] = []
  conflictsLeft = 0
  authOk = true
  push = true
  failBlobs = false
  /** Fine-grained token without Contents: write. */
  tokenCanWrite = true
  #n = 0

  constructor(initial: Manifest = emptyManifest()) {
    this.head = this.#id()
    this.commits.set(this.head, { tree: { 'library/manifest.json': JSON.stringify(initial) }, parent: null, message: 'init' })
  }

  #id() { return `sha${++this.#n}` }

  manifest(sha = this.head): Manifest { return JSON.parse(this.commits.get(sha)!.tree['library/manifest.json']) }
  file(path: string) { return this.commits.get(this.head)!.tree[path] }

  externalCommit(m: Manifest) {
    const sha = this.#id()
    this.commits.set(sha, { tree: { ...this.commits.get(this.head)!.tree, 'library/manifest.json': JSON.stringify(m) }, parent: this.head, message: 'external' })
    this.head = sha
  }

  fetch: FetchLike = async (url, init = {}) => {
    const method = init.method ?? 'GET'
    const u = new URL(url)
    const p = u.pathname.replace(/^\/repos\/[^/]+\/[^/]+/, '')
    this.calls.push(`${method} ${p}`)
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })
    if (!this.authOk) return json(401, { message: 'Bad credentials' })
    const body = init.body ? JSON.parse(String(init.body)) : {}
    let m
    if (p === '' && method === 'GET') return json(200, { default_branch: 'main', permissions: { push: this.push } })
    if (p === '/git/ref/heads/main') return json(200, { object: { sha: this.head } })
    if ((m = /^\/git\/commits\/(\w+)$/.exec(p))) return json(200, { tree: { sha: `t-${m[1]}` } })
    if ((m = /^\/contents\/(.+)$/.exec(p))) {
      const ref = u.searchParams.get('ref') ?? 'main'
      const f = this.commits.get(ref === 'main' ? this.head : ref)?.tree[decodeURIComponent(m[1])]
      return f === undefined ? json(404, { message: 'Not Found' }) : new Response(f, { status: 200 })
    }
    if (p === '/git/blobs' && method === 'POST') {
      if (this.failBlobs) throw new TypeError('Failed to fetch')
      if (!this.tokenCanWrite) return json(403, { message: 'Resource not accessible by personal access token' })
      const sha = this.#id()
      this.blobs.set(sha, body.encoding === 'base64' ? Buffer.from(body.content, 'base64').toString('latin1') : body.content)
      return json(201, { sha })
    }
    if (p === '/git/trees' && method === 'POST') {
      const base = { ...this.commits.get(body.base_tree.slice(2))!.tree }
      for (const e of body.tree) {
        if (e.sha === null) delete base[e.path]
        else base[e.path] = this.blobs.get(e.sha)!
      }
      const sha = this.#id()
      this.trees.set(sha, base)
      return json(201, { sha })
    }
    if (p === '/git/commits' && method === 'POST') {
      const sha = this.#id()
      this.commits.set(sha, { tree: this.trees.get(body.tree)!, parent: body.parents[0], message: body.message })
      return json(201, { sha })
    }
    if (p === '/git/refs/heads/main' && method === 'PATCH') {
      if (this.conflictsLeft > 0) {
        this.conflictsLeft--
        // simulate another device committing in between
        this.externalCommit(this.manifest())
        return json(422, { message: 'Update is not a fast forward' })
      }
      if (this.commits.get(body.sha)!.parent !== this.head) return json(422, { message: 'Update is not a fast forward' })
      this.head = body.sha
      this.pushes.push(this.commits.get(body.sha)!.message)
      return json(200, {})
    }
    return json(404, { message: `unhandled ${method} ${p}` })
  }
}
