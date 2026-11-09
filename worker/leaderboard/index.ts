/**
 * The reading leaderboard's progress store: a Cloudflare Worker with one KV
 * namespace. It holds each reader's latest check-in and nothing else, and has
 * no access to the site's repository.
 *
 *   GET  /board      → { A: record | null, M: record | null }
 *   PUT  /board/:who → body {bookId, page, pages}; returns the updated board
 */

import { MAX_BODY_BYTES, READERS, catalogueFrom, parseReader, parseRecord, validateCheckIn, type Board } from './validate'

/** The subset of Cloudflare's KVNamespace this Worker uses. */
export interface KV {
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
}

export interface Env {
  BOARD: KV
  /** The published site, ending in a slash, e.g. https://owner.github.io/library/ */
  SITE_URL: string
  /** The only origin browsers may call from, e.g. https://owner.github.io */
  ALLOWED_ORIGIN: string
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>

const key = (reader: string) => `reader:${reader}`

async function readBoard(env: Env): Promise<Board> {
  const [a, m] = await Promise.all(READERS.map((r) => env.BOARD.get(key(r))))
  return { A: parseRecord(a), M: parseRecord(m) }
}

export async function handle(request: Request, env: Env, fetchFn: Fetch = fetch): Promise<Response> {
  const cors = {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
    Vary: 'Origin',
  }
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  const error = (message: string, status: number) => json({ error: message }, status)

  const { pathname } = new URL(request.url)
  const match = /^\/board(?:\/([^/]+))?\/?$/.exec(pathname)
  if (!match) return error('Not found.', 404)
  const who = match[1]

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...cors,
        'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  if (who === undefined) {
    if (request.method !== 'GET') return error('Method not allowed.', 405)
    return json(await readBoard(env))
  }

  if (request.method !== 'PUT') return error('Method not allowed.', 405)
  const reader = parseReader(who)
  if (!reader) return error('Unknown reader.', 400)

  const declared = Number(request.headers.get('Content-Length') ?? 0)
  if (declared > MAX_BODY_BYTES) return error('Body too large.', 413)
  const text = await request.text()
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return error('Body too large.', 413)
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return error('Expected a JSON object.', 400)
  }

  let catalogue
  try {
    const res = await fetchFn(new URL('library/manifest.json', env.SITE_URL).href, {
      // Cloudflare-only option: cache the manifest briefly at the edge.
      cf: { cacheTtl: 60, cacheEverything: true },
    } as RequestInit)
    if (!res.ok) throw new Error(String(res.status))
    catalogue = catalogueFrom(await res.json())
  } catch {
    return error('Could not load the catalogue.', 502)
  }

  const result = validateCheckIn(reader, body, catalogue)
  if (!result.ok) return error(result.error, 400)

  await env.BOARD.put(key(reader), JSON.stringify({ ...result.record, updatedAt: new Date().toISOString() }))
  return json(await readBoard(env))
}

export default {
  fetch: (request: Request, env: Env) => handle(request, env),
}
