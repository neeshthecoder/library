import { createDialog, esc, openDialog } from '../ui/dialog'
import type { Settings } from './cache'
import { GitHub, repoFromLocation, type FetchLike, type VerifyResult } from './github'

export const PUBLIC_NOTICE =
  'Books you add are stored in this site’s GitHub repository. Anyone with the link can download them, and deleted books stay in the repository’s history.'

export function verifyMessage(r: VerifyResult, owner: string, repo: string): string {
  switch (r.error) {
    case 'auth':
      return 'That token wasn’t accepted. Check that you copied all of it and that it hasn’t expired.'
    case 'no-push':
      return `This token can’t write to ${owner}/${repo}. Give it “Contents: Read and write” access to this repository.`
    case 'not-found':
      return `${owner}/${repo} wasn’t found, or the token can’t see it. Check the owner and name, and that the token includes this repository.`
    case 'network':
      return 'GitHub couldn’t be reached. Check your connection and try again.'
    default:
      return ''
  }
}

/** Asks for repository details and a token, verifies them, and resolves with settings (or null if cancelled). */
export async function openConnectDialog(opts: { current?: Settings | null; fetch?: FetchLike; reason?: string } = {}): Promise<Settings | null> {
  const guess = repoFromLocation(location)
  // On the published site, only this site's own repository can be connected.
  const locked = !!(guess.owner && guess.repo)
  const ro = locked ? ' readonly aria-readonly="true"' : ''
  const cur = opts.current
  const d = createDialog('connect-title')
  d.innerHTML = `
    <form class="dialog-form" method="dialog" novalidate>
      <h2 class="dialog-title" id="connect-title">Connect your library</h2>
      ${opts.reason ? `<p class="dialog-body" style="margin:0">${esc(opts.reason)}</p>` : ''}
      <p class="fine" style="margin:0">${esc(PUBLIC_NOTICE)}</p>
      <div class="field"><label for="c-owner">Repository owner</label>
        <input class="input" id="c-owner" name="owner" autocomplete="off" autocapitalize="off" spellcheck="false" required${ro} value="${esc(locked ? guess.owner : cur?.owner ?? guess.owner)}"></div>
      <div class="field"><label for="c-repo">Repository name</label>
        <input class="input" id="c-repo" name="repo" autocomplete="off" autocapitalize="off" spellcheck="false" required${ro} value="${esc(locked ? guess.repo : cur?.repo ?? guess.repo)}"></div>
      <div class="field"><label for="c-branch">Branch</label>
        <input class="input" id="c-branch" name="branch" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Default branch" value="${esc(cur?.branch ?? '')}"></div>
      <div class="field"><label for="c-token">Personal access token</label>
        <input class="input" id="c-token" name="token" type="password" autocomplete="off" spellcheck="false" required aria-describedby="c-token-hint">
        <p class="fine field-hint" id="c-token-hint">Use a fine-grained token for this repository only, with “Contents: Read and write” access and an expiry date. It stays on this device.</p></div>
      <p class="field-error" id="c-error" role="alert"></p>
      <div class="dialog-actions">
        <button type="button" class="btn btn-secondary" value="cancel" data-cancel>Cancel</button>
        <button type="submit" class="btn btn-primary">Connect</button>
      </div>
    </form>`
  const form = d.querySelector('form')!
  const err = d.querySelector<HTMLElement>('#c-error')!
  const submit = d.querySelector<HTMLButtonElement>('button[type="submit"]')!
  let result: Settings | null = null

  d.querySelector('[data-cancel]')!.addEventListener('click', () => d.close('cancel'))
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const data = new FormData(form)
    const owner = String(data.get('owner')).trim()
    const repo = String(data.get('repo')).trim()
    const token = String(data.get('token')).trim()
    let branch = String(data.get('branch')).trim()
    if (!owner || !repo || !token) {
      err.textContent = 'Fill in the owner, repository name, and token.'
      return
    }
    submit.disabled = true
    submit.textContent = 'Checking…'
    const r = await new GitHub({ owner, repo, token, branch: branch || 'main' }, opts.fetch).verify()
    submit.disabled = false
    submit.textContent = 'Connect'
    if (!r.ok) {
      err.textContent = verifyMessage(r, owner, repo)
      return
    }
    branch = branch || r.defaultBranch || 'main'
    result = { owner, repo, token, branch }
    d.close('ok')
  })

  const initial = d.querySelector<HTMLInputElement>(locked || cur?.owner ? '#c-token' : '#c-owner')
  await openDialog(d, initial)
  return result
}

/** Shows connection status with connect/disconnect actions. Resolves with the chosen action. */
export async function openSettingsDialog(current: Settings | null): Promise<'connect' | 'disconnect' | null> {
  const d = createDialog('settings-title')
  d.innerHTML = `
    <h2 class="dialog-title" id="settings-title">Library settings</h2>
    <p class="dialog-body">${current
      ? `Connected to <strong>${esc(current.owner)}/${esc(current.repo)}</strong> on the ${esc(current.branch)} branch. This device can add and delete books. Disconnecting removes the token, cached books, and reading positions from this device.`
      : 'This device isn’t connected. You can read books, but adding or deleting them needs a connection.'}</p>
    <p class="fine">${esc(PUBLIC_NOTICE)}</p>
    <div class="dialog-actions">
      <button type="button" class="btn btn-secondary" data-v="close">Close</button>
      ${current
        ? '<button type="button" class="btn btn-primary" data-v="disconnect">Disconnect</button>'
        : '<button type="button" class="btn btn-primary" data-v="connect">Connect</button>'}
    </div>`
  d.addEventListener('click', (e) => {
    const v = (e.target as HTMLElement).closest<HTMLElement>('[data-v]')?.dataset.v
    if (v) d.close(v)
  })
  const v = await openDialog(d, d.querySelector<HTMLElement>('[data-v="close"]'))
  return v === 'connect' || v === 'disconnect' ? v : null
}
