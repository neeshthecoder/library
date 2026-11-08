/** A single app-wide live region for plain messages (errors, notices). */
let region: HTMLElement | null = null
let timer: number | undefined

export function mountMessages(parent: HTMLElement = document.body): HTMLElement {
  region = document.createElement('div')
  region.className = 'app-messages'
  region.setAttribute('role', 'alert')
  parent.append(region)
  region.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-dismiss]')) clearMessages()
  })
  return region
}

export function showMessages(lines: string[], kind: 'error' | 'info' = 'error', timeoutMs = 0): void {
  if (!region) mountMessages()
  const r = region!
  r.replaceChildren()
  if (!lines.length) return
  const card = document.createElement('div')
  card.className = `app-message-card app-message-${kind}`
  for (const l of lines) {
    const p = document.createElement('p')
    p.className = 'message'
    p.textContent = l
    card.append(p)
  }
  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'link-btn'
  close.dataset.dismiss = ''
  close.textContent = 'Dismiss'
  card.append(close)
  r.append(card)
  window.clearTimeout(timer)
  if (timeoutMs) timer = window.setTimeout(clearMessages, timeoutMs)
}

export function clearMessages(): void {
  region?.replaceChildren()
}
