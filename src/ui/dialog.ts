/**
 * Opens a native modal <dialog>. Focus is trapped by the browser; on close,
 * focus returns to the element focused before opening. Resolves with the
 * dialog's returnValue.
 */
export function openDialog(dialog: HTMLDialogElement, initialFocus?: HTMLElement | null): Promise<string> {
  const previous = document.activeElement as HTMLElement | null
  if (!dialog.isConnected) document.body.append(dialog)
  return new Promise((resolve) => {
    dialog.addEventListener(
      'close',
      () => {
        const value = dialog.returnValue
        dialog.remove()
        if (previous?.isConnected) previous.focus()
        resolve(value)
      },
      { once: true },
    )
    dialog.showModal()
    initialFocus?.focus()
  })
}

export function createDialog(labelledBy: string, className = ''): HTMLDialogElement {
  const d = document.createElement('dialog')
  d.className = `dialog ${className}`.trim()
  d.setAttribute('aria-labelledby', labelledBy)
  d.returnValue = ''
  return d
}

/** Escapes text for insertion into HTML templates. */
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
