import type { SpineSettings } from '../../storage/manifest'
import { coverSpine } from './cover'
import type { TrimDrawing } from './common'

export const LOW_DETAIL_PX = 56
const MIN_UNITS_H = 320

export interface SpineArt {
  svg: string
  /** Title panel in px, relative to the spine's top-left corner. */
  panel: { x: number; y: number; width: number; height: number }
}

/**
 * Every spine uses the same plain design: a flat color with two accent bands
 * and a wide title panel. Colors come from the cover when there is one, or are
 * generated otherwise. (The ornamental trims were removed: they made titles
 * hard to read. Old manifest entries with a `design` render the same way.)
 */
export function drawingFor(_spine: Pick<SpineSettings, 'source' | 'design'>, H: number, lowDetail: boolean): TrimDrawing {
  return coverSpine({ H, lowDetail })
}

/** Renders spine art as an SVG string sized to the given pixel box. */
export function renderSpineArt(spine: Pick<SpineSettings, 'source' | 'design'>, widthPx: number, heightPx: number): SpineArt {
  const H = Math.max(MIN_UNITS_H, (100 * heightPx) / widthPx)
  const lowDetail = widthPx < LOW_DETAIL_PX
  const d = drawingFor(spine, H, lowDetail)
  const s = widthPx / 100
  const sy = heightPx / H
  const svg =
    `<svg class="spine-art" viewBox="0 0 100 ${H.toFixed(2)}" width="${widthPx}" height="${heightPx}" ` +
    `preserveAspectRatio="none" aria-hidden="true" focusable="false" data-detail="${lowDetail ? 'low' : 'full'}">${d.body}</svg>`
  return {
    svg,
    panel: { x: d.panel.x * s, y: d.panel.y * sy, width: d.panel.w * s, height: d.panel.h * sy },
  }
}
