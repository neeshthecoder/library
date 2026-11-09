import { describe, expect, it } from 'vitest'
import { cspFor, leaderboardOrigin } from '../../vite.config'

const connect = (csp: string) => csp.split('; ').find((d) => d.startsWith('connect-src'))

describe('Content Security Policy', () => {
  it('allows only the site and GitHub when no leaderboard is configured', () => {
    expect(connect(cspFor(''))).toBe("connect-src 'self' https://api.github.com")
  })

  it('adds exactly the leaderboard origin when configured', () => {
    const origin = leaderboardOrigin('https://library-leaderboard.example.workers.dev/some/path')
    expect(origin).toBe('https://library-leaderboard.example.workers.dev')
    expect(connect(cspFor(origin))).toBe("connect-src 'self' https://api.github.com https://library-leaderboard.example.workers.dev")
  })

  it('treats an empty value as unset and refuses plain http', () => {
    expect(leaderboardOrigin('')).toBe('')
    expect(leaderboardOrigin('  ')).toBe('')
    expect(() => leaderboardOrigin('http://evil.example')).toThrow()
    expect(leaderboardOrigin('http://localhost:8787')).toBe('http://localhost:8787')
  })
})
