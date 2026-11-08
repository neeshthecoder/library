import type { SpineSettings } from '../../storage/manifest'
import { arch } from './arch'
import { coverSpine } from './cover'
import { frame } from './frame'
import { medallion } from './medallion'
import type { TrimDrawing } from './common'

export const LOW_DETAIL_PX = 56
const MIN_UNITS_H = 320

export interface SpineArt {
  svg: string
  /** Title panel in px, relative to the spine's top-left corner. */
  panel: { x: number; y: number; width: number; height: number }
}

export function drawingFor(spine: Pick<SpineSettings, 'source' | 'design'>, H: number, lowDetail: boolean): TrimDrawing {
  if (spine.source === 'cover') return coverSpine({ H, lowDetail })
  switch (spine.design) {
    case 'medallion':
      return medallion({ H, lowDetail })
    case 'arch':
      return arch({ H, lowDetail })
    default:
      return frame({ H, lowDetail })
  }
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
