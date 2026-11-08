// Minimal types for the vendored foliate-js modules we use.
declare module '@vendor/foliate-js/view.js' {
  export interface FoliateSection {
    id?: string
    size: number
    linear?: string
  }
  export interface FoliateBook {
    metadata?: { title?: string | Record<string, string>; language?: string | string[] }
    sections: FoliateSection[]
    dir?: string
    rendition?: { layout?: string }
    getCover?(): Promise<Blob | null>
    destroy?(): void
  }
  export interface RelocateDetail {
    cfi?: string
    fraction?: number
    location?: { current: number; next: number; total: number }
    reason?: string
  }
  export interface FoliateRenderer extends HTMLElement {
    next(): Promise<void>
    prev(): Promise<void>
    setStyles?(styles: string | [string, string]): void
    focusView?(): void
  }
  export interface FoliateView extends HTMLElement {
    book: FoliateBook
    renderer: FoliateRenderer
    lastLocation?: RelocateDetail | null
    open(book: FoliateBook | File | Blob): Promise<void>
    init(opts: { lastLocation?: string | null; showTextStart?: boolean }): Promise<void>
    goTo(target: string | number): Promise<unknown>
    goToFraction(f: number): Promise<void>
    next(): Promise<void>
    prev(): Promise<void>
    close(): void
  }
  export function makeBook(file: File | Blob): Promise<FoliateBook>
  export class UnsupportedTypeError extends Error {}
  export class NotFoundError extends Error {}
  export class View extends HTMLElement {}
}
