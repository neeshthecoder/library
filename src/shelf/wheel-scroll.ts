const LINE_PX = 16

/** Normalizes a wheel delta to pixels. */
export function deltaPx(delta: number, mode: number, pagePx: number): number {
  if (mode === 1) return delta * LINE_PX
  if (mode === 2) return delta * pagePx
  return delta
}

/**
 * Returns the horizontal scroll to apply for a wheel event, or null to let the
 * page handle it (horizontal gestures, or already at the end in that direction).
 */
export function wheelToHorizontal(
  e: { deltaX: number; deltaY: number; deltaMode: number },
  el: { scrollLeft: number; scrollWidth: number; clientWidth: number },
): number | null {
  if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return null
  const dy = deltaPx(e.deltaY, e.deltaMode, el.clientWidth)
  const max = el.scrollWidth - el.clientWidth
  if (max <= 0) return null
  if (dy > 0 && el.scrollLeft >= max - 1) return null
  if (dy < 0 && el.scrollLeft <= 0) return null
  return dy
}

export function bindWheelScroll(el: HTMLElement): () => void {
  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey) return // pinch-zoom
    const dx = wheelToHorizontal(e, el)
    if (dx === null) return
    e.preventDefault()
    el.scrollLeft += dx
  }
  el.addEventListener('wheel', onWheel, { passive: false })
  return () => el.removeEventListener('wheel', onWheel)
}
