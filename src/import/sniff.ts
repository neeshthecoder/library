import type { Format } from '../storage/manifest'

export type SniffResult = { format: Format } | { error: 'unsupported' | 'kfx' }

const ascii = (b: Uint8Array, start: number, len: number) =>
  String.fromCharCode(...b.subarray(start, Math.min(b.length, start + len)))

const u16 = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1]
const u32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0
const le16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8)

/** Offset of PDB record 0 in a MOBI/AZW file. */
export function mobiRecord0(b: Uint8Array): number {
  return u32(b, 78)
}

export interface MobiHeader {
  encryption: number
  version: number
  title: string | null
  exth: Map<number, Uint8Array[]>
}

/** Parses the PalmDOC + MOBI + EXTH headers of record 0. */
export function parseMobiHeader(b: Uint8Array): MobiHeader | null {
  if (b.length < 86 || ascii(b, 60, 8) !== 'BOOKMOBI') return null
  const r0 = mobiRecord0(b)
  if (r0 + 16 + 24 > b.length) return null
  const encryption = u16(b, r0 + 12)
  const mobi = r0 + 16
  if (ascii(b, mobi, 4) !== 'MOBI') return { encryption, version: 0, title: null, exth: new Map() }
  const headerLen = u32(b, mobi + 4)
  const encoding = u32(b, mobi + 12)
  const version = u32(b, mobi + 20)
  const exth = new Map<number, Uint8Array[]>()
  const flags = u32(b, mobi + 0x70)
  const decoder = new TextDecoder(encoding === 1252 ? 'windows-1252' : 'utf-8')
  if (flags & 0x40) {
    let o = mobi + headerLen
    if (ascii(b, o, 4) === 'EXTH') {
      const count = u32(b, o + 8)
      o += 12
      for (let i = 0; i < count && o + 8 <= b.length; i++) {
        const type = u32(b, o)
        const len = u32(b, o + 4)
        if (len < 8) break
        const list = exth.get(type) ?? []
        list.push(b.subarray(o + 8, o + len))
        exth.set(type, list)
        o += len
      }
    }
  }
  let title: string | null = null
  const exthTitle = exth.get(503)?.[0]
  if (exthTitle) title = decoder.decode(exthTitle)
  else {
    const off = u32(b, mobi + 0x44)
    const len = u32(b, mobi + 0x48)
    if (off && len && r0 + off + len <= b.length) title = decoder.decode(b.subarray(r0 + off, r0 + off + len))
  }
  return { encryption, version, title: title?.trim() || null, exth }
}

/** Identifies a book by signature. Needs the first ~64 KB (whole file for odd zips). */
export function sniffBytes(b: Uint8Array): SniffResult | 'zip' {
  if (ascii(b, 0, 5) === '%PDF-') return { format: 'pdf' }
  // Some PDFs have junk before the header; the spec allows it within 1 KB.
  if (ascii(b, 0, 1024).includes('%PDF-')) return { format: 'pdf' }
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) {
    const nameLen = le16(b, 26)
    const extraLen = le16(b, 28)
    if (ascii(b, 30, nameLen) === 'mimetype') {
      const start = 30 + nameLen + extraLen
      if (ascii(b, start, 20) === 'application/epub+zip') return { format: 'epub' }
    }
    return 'zip'
  }
  const magic = ascii(b, 60, 8)
  if (magic === 'BOOKMOBI') {
    const h = parseMobiHeader(b)
    return { format: h && h.version >= 8 ? 'azw3' : 'mobi' }
  }
  if (ascii(b, 0, 4) === 'CONT' || ascii(b, 0, 4) === 'TPZ0' || ascii(b, 0, 3) === 'TPZ' || ascii(b, 0, 8) === '\xeaDRMION\xee') {
    return { error: 'kfx' }
  }
  return { error: 'unsupported' }
}

/** Identifies a file. Zips without a leading mimetype are checked for an OPF container. */
export async function sniff(file: Blob): Promise<SniffResult> {
  const head = new Uint8Array(await file.slice(0, 64 * 1024).arrayBuffer())
  const r = sniffBytes(head)
  if (r !== 'zip') return r
  const { unzipSync } = await import('fflate')
  try {
    let isEpub = false
    unzipSync(new Uint8Array(await file.arrayBuffer()), {
      filter: (f) => {
        if (f.name === 'META-INF/container.xml') isEpub = true
        return false
      },
    })
    return isEpub ? { format: 'epub' } : { error: 'unsupported' }
  } catch {
    return { error: 'unsupported' }
  }
}
