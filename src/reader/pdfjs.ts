import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

type Pdfjs = typeof import('pdfjs-dist')
let loaded: Promise<Pdfjs> | null = null

/** Lazily loads pdf.js and points it at its worker. */
export function loadPdfjs(): Promise<Pdfjs> {
  loaded ??= import('pdfjs-dist').then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    return pdfjs
  })
  return loaded
}

export async function openPdf(data: Blob) {
  const pdfjs = await loadPdfjs()
  const bytes = new Uint8Array(await data.arrayBuffer())
  return pdfjs.getDocument({ data: bytes, enableXfa: false, isOffscreenCanvasSupported: true }).promise
}
