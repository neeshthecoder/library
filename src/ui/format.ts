export const GB = 1024 ** 3
export const MB = 1024 ** 2
export const LIBRARY_LIMIT = 1 * GB
export const LIBRARY_WARN = 800 * MB
export const FILE_LIMIT = 100 * MB
export const FILE_SLOW = 50 * MB

/** "184 MB", "1.2 GB", "640 KB". */
export function formatSize(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(1).replace(/\.0$/, '')} GB`
  if (bytes >= MB) return `${Math.round(bytes / MB)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} bytes`
}

export function libraryReadout(count: number, bytes: number): { text: string; nearLimit: boolean } {
  const books = `${count} ${count === 1 ? 'book' : 'books'}`
  const nearLimit = bytes > LIBRARY_WARN
  const base = `${books} · ${formatSize(bytes)} of about 1 GB`
  return { text: nearLimit ? `${base}. The library is close to its storage limit.` : base, nearLimit }
}
