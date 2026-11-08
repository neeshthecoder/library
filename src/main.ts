import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './spines/spine.css'
import './shelf/shelf.css'
import './shelf/bookcase.css'
import './import/import.css'
import './reader/reader.css'

import { navigate, onRouteChange, parseHash, type Route } from './router'
import { ShelfView } from './shelf/shelf-view'
import { Cache } from './storage/cache'
import { openConnectDialog, openSettingsDialog } from './storage/connect-dialog'
import { Library, NotConnectedError, uploadsFrom } from './storage/library'
import type { Book } from './storage/manifest'
import { PositionSync } from './storage/sync'
import { installDragOverlay } from './import/drag-overlay'
import { pickFiles, processFiles } from './import/queue'
import { clearMessages, mountMessages, showMessages } from './ui/messages'
import type { ReaderView } from './reader/reader-view'

const app = document.getElementById('app')!
mountMessages()

const library = new Library({ cache: new Cache(), base: import.meta.env.BASE_URL })
const sync = new PositionSync(library, {
  onError: () => showMessages(['Your reading position couldn’t be synced. It’s saved on this device and will sync later.'], 'info', 6000),
})
sync.bindVisibility()

let route: Route = parseHash(location.hash)
let reader: ReaderView | null = null
let lastBookId: string | null = null
const importQueue: File[][] = []
let importing = false

const shelf = new ShelfView({
  onOpen: (id) => navigate({ name: 'reader', id }),
  onAddBook: () => void pickFiles().then(importFiles),
  onSettings: () => void settings(),
  onRetry: (id) => void startUpload(id),
})

function renderShelf(): void {
  const s = library.store.get()
  const m = library.manifest
  shelf.update({ books: m.books, totalBytes: library.totalBytes(), uploads: uploadsFrom(s), loading: s.loading })
}
library.store.subscribe(renderShelf)

async function ensureConnected(reason?: string): Promise<boolean> {
  if (library.connected) return true
  const s = await openConnectDialog({ reason })
  if (!s) return false
  await library.connect(s)
  return true
}

async function settings(): Promise<void> {
  const action = await openSettingsDialog(library.store.get().settings)
  if (action === 'disconnect') {
    await library.disconnect()
    showMessages(['This device is disconnected. The token was removed.'], 'info', 5000)
  } else if (action === 'connect') {
    if (await ensureConnected()) showMessages(['This device is connected.'], 'info', 4000)
  }
}

async function startUpload(id: string): Promise<void> {
  if (!library.connected && !(await ensureConnected('Connect your library to save this book permanently.'))) return
  try {
    await library.upload(id)
  } catch (e) {
    if (e instanceof NotConnectedError) return
    const title = library.book(id)?.title ?? 'The book'
    showMessages([`${title} couldn’t be uploaded. ${e instanceof Error ? e.message : ''}`.trim()])
  }
}

/** Queues dropped or picked files; batches are processed one after another. */
async function importFiles(files: File[]): Promise<void> {
  if (!files.length) return
  importQueue.push(files)
  if (importing) return
  importing = true
  try {
    while (importQueue.length) await importBatch(importQueue.shift()!)
  } finally {
    importing = false
  }
}

async function importBatch(files: File[]): Promise<void> {
  clearMessages()
  {
    const [{ readInfo }, { coverColors }, { openPreviewDialog }] = await Promise.all([
      import('./import/metadata'),
      import('./spines/cover-colors'),
      import('./import/preview-dialog'),
    ])
    await processFiles(files, {
      readInfo,
      coverColors,
      usedBytes: () => library.totalBytes(),
      preview: openPreviewDialog,
      report: (lines) => showMessages(lines),
      add: async (book: Book, file: File) => {
        await library.add(book, file)
        if (route.name === 'shelf') requestAnimationFrame(() => shelf.revealSpine(book.id))
        void startUpload(book.id)
      },
    })
  }
}

installDragOverlay((files) => void importFiles(files))

async function show(next: Route): Promise<void> {
  route = next
  if (reader) {
    reader.destroy()
    reader = null
    void sync.flush()
  }
  if (next.name === 'reader') {
    const book = library.book(next.id)
    if (!book) {
      if (library.store.get().loading) return // wait for the manifest
      navigate({ name: 'shelf' }, { replace: true })
      showMessages(['That book is no longer in the library.'])
      return
    }
    lastBookId = book.id
    const { ReaderView } = await import('./reader/reader-view')
    if (route !== next) return
    const view = new ReaderView(book, library, {
      onBack: () => navigate({ name: 'shelf' }),
      onDeleted: (b) => {
        lastBookId = null
        navigate({ name: 'shelf' })
        showMessages([`${b.title} was deleted.`], 'info', 4000)
      },
      onPageTurn: () => sync.notePageTurn(),
      ensureConnected: (reason) => ensureConnected(reason),
    })
    reader = view
    document.title = `${book.title} · The bookshelf`
    app.replaceChildren(view.el)
    void view.open()
  } else {
    document.title = 'The bookshelf'
    app.replaceChildren(shelf.el)
    renderShelf()
    shelf.restoreScroll()
    if (lastBookId) {
      const id = lastBookId
      requestAnimationFrame(() => shelf.focusSpine(id))
    }
  }
}

onRouteChange((r) => void show(r))
void show(route)
library.init().then(async () => {
  renderShelf()
  if (route.name === 'reader' && !reader) await show(route)
  if (library.store.get().error) showMessages([library.store.get().error!])
  void sync.flush() // retry positions that didn't sync last time
})
