import { defineConfig, type Plugin } from 'vite'
import { FontaineTransform } from 'fontaine'
import { fileURLToPath } from 'node:url'

const base = process.env.BASE_PATH || '/'

/**
 * The origin of the reading leaderboard's progress store (VITE_LEADERBOARD_URL),
 * or '' when none is configured. Throws on a value that isn't an https URL
 * (http is allowed only for localhost).
 */
export function leaderboardOrigin(url = process.env.VITE_LEADERBOARD_URL ?? ''): string {
  if (!url.trim()) return ''
  const u = new URL(url.trim())
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1'
  if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) throw new Error(`VITE_LEADERBOARD_URL must be https: ${url}`)
  return u.origin
}

// The production Content Security Policy. Injected only into the build, since
// the dev server needs websockets and inline HMR styles. The only extra
// connection allowed beyond GitHub is the leaderboard store, when configured.
export const cspFor = (leaderboard = leaderboardOrigin()) => [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self' https://api.github.com${leaderboard ? ` ${leaderboard}` : ''}`,
  "worker-src 'self' blob:",
  "frame-src 'self' blob:",
  "child-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

export const CSP = cspFor()

const cspPlugin = (): Plugin => ({
  name: 'inject-csp',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
    ],
  },
})

export default defineConfig({
  base,
  plugins: [
    FontaineTransform.vite({
      fallbacks: {
        'Instrument Serif': ['Times New Roman', 'Georgia'],
        'EB Garamond': ['Times New Roman', 'Georgia'],
        Cardo: ['Times New Roman', 'Georgia'],
        'TeX Gyre Pagella': ['Palatino', 'Georgia'],
        'Cormorant Garamond': ['Times New Roman', 'Georgia'],
        'Crimson Pro': ['Times New Roman', 'Georgia'],
      },
      resolvePath: (id: string) => new URL(`./public${id.replace(base, '/')}`, import.meta.url),
    }),
    cspPlugin(),
  ],
  build: {
    target: 'es2022',
    manifest: true,
    // pdf.js ships top-level await; es2022 supports it.
  },
  worker: { format: 'es' },
  resolve: {
    alias: { '@vendor': fileURLToPath(new URL('./vendor', import.meta.url)) },
  },
})
