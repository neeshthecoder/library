import { formatSize, FILE_LIMIT } from '../ui/format'

export const MSG = {
  unsupported: 'That file type isn’t supported. Add a PDF, EPUB, MOBI, or AZW3 file.',
  kfx: 'Kindle KFX files aren’t supported. Add a PDF, EPUB, MOBI, or AZW3 file.',
  drm: 'This book is DRM-protected, so it can’t be opened here. Add a DRM-free copy.',
  password: 'This PDF needs a password to open. Add an unlocked copy.',
  unreadable: 'This file couldn’t be opened. It may be damaged.',
  libraryFull: 'Adding this book would take the library past its 1 GB storage limit. Delete a book first.',
  slow: 'Large files can take a while to upload.',
  tooLarge: (bytes: number) => `This file is ${formatSize(bytes)}. The limit is ${formatSize(FILE_LIMIT)}.`,
} as const

/** Prefixes a message with the file name for multi-file reports. */
export const forFile = (name: string, msg: string) => `${name}: ${msg}`
