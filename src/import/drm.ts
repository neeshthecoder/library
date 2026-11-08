import type { Format } from '../storage/manifest'
import { parseMobiHeader } from './sniff'

/** Font obfuscation algorithms: not DRM. */
export const FONT_OBFUSCATION = new Set([
  'http://www.idpf.org/2008/embedding',
  'http://ns.adobe.com/pdf/enc#RC',
])

export type DrmResult = 'none' | 'drm'

/** Inspects encryption.xml: DRM if anything uses a non-font-obfuscation algorithm. */
export function encryptionXmlIsDrm(xml: string): boolean {
  const algos = [...xml.matchAll(/EncryptionMethod[^>]*Algorithm\s*=\s*["']([^"']+)["']/g)].map((m) => m[1].trim())
  const hasData = /EncryptedData/.test(xml)
  if (!hasData) return false
  if (!algos.length) return true
  return algos.some((a) => !FONT_OBFUSCATION.has(a))
}

export async function epubDrm(file: Blob): Promise<DrmResult> {
  const { unzipSync, strFromU8 } = await import('fflate')
  const want = new Set(['META-INF/encryption.xml', 'META-INF/rights.xml', 'META-INF/sinf.xml', 'META-INF/license.lcpl'])
  const found = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: (f) => want.has(f.name) })
  if (found['META-INF/rights.xml'] || found['META-INF/sinf.xml'] || found['META-INF/license.lcpl']) return 'drm'
  const enc = found['META-INF/encryption.xml']
  if (enc && encryptionXmlIsDrm(strFromU8(enc))) return 'drm'
  return 'none'
}

export function mobiDrm(head: Uint8Array): DrmResult {
  const h = parseMobiHeader(head)
  return h && h.encryption !== 0 ? 'drm' : 'none'
}

/** Non-standard PDF security handlers (Adobe ADEPT, LiveCycle, FileOpen) are DRM. */
export function pdfBytesDrm(text: string): DrmResult {
  if (!/\/Encrypt\b/.test(text)) return 'none'
  if (/\/Filter\s*\/(EBX_HANDLER|Adobe\.APS|FOPN_\w+|PubSec\w*)/.test(text)) return 'drm'
  return 'none'
}

export async function checkDrm(file: Blob, format: Format): Promise<DrmResult> {
  if (format === 'epub') return epubDrm(file)
  if (format === 'mobi' || format === 'azw3') return mobiDrm(new Uint8Array(await file.slice(0, 64 * 1024).arrayBuffer()))
  // PDF: the encryption dictionary is usually near the end; scan head and tail.
  const head = await file.slice(0, 256 * 1024).text()
  const tail = file.size > 256 * 1024 ? await file.slice(-256 * 1024).text() : ''
  return pdfBytesDrm(head + tail)
}
