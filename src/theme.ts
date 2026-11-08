export type Theme = 'day' | 'night'

export const DAY_START = 7 // 07:00
export const NIGHT_START = 19 // 19:00

/** Day is 07:00–18:59 local time; night is 19:00–06:59. */
export function themeAt(d: Date): Theme {
  const h = d.getHours()
  return h >= DAY_START && h < NIGHT_START ? 'day' : 'night'
}

/** Milliseconds until the next 07:00 or 19:00. */
export function msUntilNextSwitch(d: Date): number {
  const next = new Date(d)
  next.setMinutes(0, 0, 0)
  const h = d.getHours()
  if (h < DAY_START) next.setHours(DAY_START)
  else if (h < NIGHT_START) next.setHours(NIGHT_START)
  else {
    next.setDate(next.getDate() + 1)
    next.setHours(DAY_START)
  }
  return next.getTime() - d.getTime()
}

export function applyTheme(theme: Theme, doc: Document = document): void {
  doc.documentElement.dataset.theme = theme
  const paper = getComputedStyle(doc.documentElement).getPropertyValue('--paper').trim()
  doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', paper)
}

/**
 * Keeps the theme in step with the clock: switches at 07:00 and 19:00, and
 * re-checks when the page becomes visible (timers pause while a laptop sleeps).
 */
export function startThemeClock(now: () => Date = () => new Date()): () => void {
  let timer: number | undefined
  const tick = () => {
    applyTheme(themeAt(now()))
    window.clearTimeout(timer)
    timer = window.setTimeout(tick, msUntilNextSwitch(now()) + 500)
  }
  const onVisible = () => document.visibilityState === 'visible' && tick()
  document.addEventListener('visibilitychange', onVisible)
  tick()
  return () => {
    window.clearTimeout(timer)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
