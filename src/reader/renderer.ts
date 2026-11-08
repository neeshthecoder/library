import type { Mode } from './spread'

export interface Location {
  locator: string
  fraction: number
  label: string
}

/** Common surface for the PDF and ebook renderers. */
export interface BookRenderer {
  open(start: string | null, fraction: number | null): Promise<void>
  next(): Promise<boolean>
  prev(): Promise<boolean>
  setMode(mode: Mode): Promise<void>
  destroy(): void
}

export interface RendererOptions {
  container: HTMLElement
  blob: Blob
  name: string
  mode: Mode
  onRelocate(loc: Location): void
  /** Key presses inside iframes (ebooks) are forwarded here. */
  onKey(e: KeyboardEvent): void
}
