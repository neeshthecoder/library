import { defineConfig, type Plugin } from 'vite'
import { FontaineTransform } from 'fontaine'
import { fileURLToPath } from 'node:url'

const base = process.env.BASE_PATH || '/'

// The production Content Security Policy. Injected only into the build, since
// the dev server needs websockets and inline HMR styles.
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self' https://api.github.com",
  "worker-src 'self' blob:",
  "frame-src 'self' blob:",
  "child-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

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
