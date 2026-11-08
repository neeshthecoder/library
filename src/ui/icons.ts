// Lucide-style outline icons, 1.5px stroke.
const svg = (d: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`

export const ICON_BACK = svg('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>')
export const ICON_TRASH = svg('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>')
export const ICON_CHECK = svg('<path d="M20 6 9 17l-5-5"/>')
