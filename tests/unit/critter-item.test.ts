// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { critterItem } from '../../src/shelf/critters'

describe('critterItem', () => {
  it('is hidden decoration by default', () => {
    const el = critterItem('acorns', 200)
    expect(el.tagName).toBe('DIV')
    expect(el.getAttribute('aria-hidden')).toBe('true')
    expect(el.querySelector('button')).toBeNull()
  })

  it('renders the squirrel theme toggle as a switch with a sign', () => {
    const el = critterItem('squirrel', 200, 'theme-toggle')
    expect(el.tagName).toBe('BUTTON')
    expect(el.classList.contains('critter-toggle')).toBe(true)
    expect(el.getAttribute('role')).toBe('switch')
    expect(el.querySelector('.critter-sign')?.textContent).toBe('Click Me!')
  })

  it('renders the leaderboard acorns as a plain button with no visible label', () => {
    const el = critterItem('acorns', 200, 'leaderboard')
    expect(el.tagName).toBe('BUTTON')
    expect(el.classList.contains('critter-leaderboard')).toBe(true)
    expect(el.getAttribute('role')).toBeNull()
    expect(el.getAttribute('aria-label')).toBe('Acorns')
    expect(el.querySelector('.critter-sign')).toBeNull()
    expect(el.textContent?.trim()).toBe('')
  })
})
