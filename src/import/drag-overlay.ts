export interface DragState {
  count: number
  visible: boolean
}

export type DragEvent_ =
  | { type: 'enter'; files: boolean }
  | { type: 'leave'; files: boolean }
  | { type: 'drop' }
  | { type: 'end' }
  | { type: 'timeout' }

export const initialDrag: DragState = { count: 0, visible: false }

/**
 * Counter-based drag state. Each dragenter on a new element is matched by a
 * dragleave on the previous one, so the count stays > 0 while over the window.
 * Non-file drags are ignored. Drop, dragend and the watchdog reset it.
 */
export function dragReducer(s: DragState, e: DragEvent_): DragState {
  switch (e.type) {
    case 'enter':
      if (!e.files) return s
      return { count: s.count + 1, visible: true }
    case 'leave': {
      if (!e.files || s.count === 0) return s
      const count = s.count - 1
      return { count, visible: count > 0 }
    }
    case 'drop':
    case 'end':
    case 'timeout':
      return initialDrag
  }
}

export const hasFiles = (dt: DataTransfer | null) => !!dt && Array.from(dt.types).includes('Files')

/** Hide if no dragover arrives for this long (covers missed dragleave events). */
export const WATCHDOG_MS = 300

/**
 * Installs the whole-window overlay. Calls `onFiles` with dropped files.
 * Returns an unbind function.
 */
export function installDragOverlay(onFiles: (files: File[]) => void, win: Window = window): () => void {
  const doc = win.document
  const overlay = doc.createElement('div')
  overlay.className = 'drag-overlay'
  overlay.hidden = true
  overlay.setAttribute('aria-hidden', 'true')
  overlay.innerHTML = '<div class="drag-overlay-box"><p class="drag-overlay-text">Drag file here</p></div>'
  doc.body.append(overlay)

  let state = initialDrag
  let timer: number | undefined
  const dispatch = (e: DragEvent_) => {
    state = dragReducer(state, e)
    overlay.hidden = !state.visible
    doc.documentElement.classList.toggle('is-dragging', state.visible)
  }
  const arm = () => {
    win.clearTimeout(timer)
    timer = win.setTimeout(() => dispatch({ type: 'timeout' }), WATCHDOG_MS)
  }

  const onEnter = (e: DragEvent) => {
    const files = hasFiles(e.dataTransfer)
    if (files) e.preventDefault()
    dispatch({ type: 'enter', files })
    if (files) arm()
  }
  const onOver = (e: DragEvent) => {
    if (!hasFiles(e.dataTransfer)) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    if (!state.visible) dispatch({ type: 'enter', files: true })
    arm()
  }
  const onLeave = (e: DragEvent) => {
    dispatch({ type: 'leave', files: hasFiles(e.dataTransfer) })
    // leaving the window entirely
    if (!e.relatedTarget && (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= win.innerWidth || e.clientY >= win.innerHeight)) {
      dispatch({ type: 'end' })
    }
  }
  const onDrop = (e: DragEvent) => {
    if (!hasFiles(e.dataTransfer)) return
    e.preventDefault()
    win.clearTimeout(timer)
    dispatch({ type: 'drop' })
    const files = Array.from(e.dataTransfer?.files ?? [])
    if (files.length) onFiles(files)
  }
  const onEnd = () => {
    win.clearTimeout(timer)
    dispatch({ type: 'end' })
  }

  win.addEventListener('dragenter', onEnter)
  win.addEventListener('dragover', onOver)
  win.addEventListener('dragleave', onLeave)
  win.addEventListener('drop', onDrop)
  win.addEventListener('dragend', onEnd)
  return () => {
    win.removeEventListener('dragenter', onEnter)
    win.removeEventListener('dragover', onOver)
    win.removeEventListener('dragleave', onLeave)
    win.removeEventListener('drop', onDrop)
    win.removeEventListener('dragend', onEnd)
    overlay.remove()
  }
}
