export type Route = { name: 'shelf' } | { name: 'reader'; id: string }

const READER = /^#\/read\/([A-Za-z0-9_-]{1,64})\/?$/

/** Parses a location hash into a route. Anything unrecognised is the shelf. */
export function parseHash(hash: string): Route {
  const m = READER.exec(hash)
  if (m) return { name: 'reader', id: m[1] }
  return { name: 'shelf' }
}

export function hrefFor(route: Route): string {
  return route.name === 'reader' ? `#/read/${route.id}` : '#/'
}

export function navigate(route: Route, opts: { replace?: boolean } = {}): void {
  const href = hrefFor(route)
  if (opts.replace) {
    history.replaceState(history.state, '', href)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else if (location.hash !== href) {
    location.hash = href
  }
}

export function onRouteChange(cb: (route: Route) => void): () => void {
  const handler = () => cb(parseHash(location.hash))
  window.addEventListener('hashchange', handler)
  return () => window.removeEventListener('hashchange', handler)
}
