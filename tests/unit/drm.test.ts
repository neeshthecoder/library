import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { checkDrm, encryptionXmlIsDrm, pdfBytesDrm } from '../../src/import/drm'

const blob = (n: string) => new Blob([readFileSync(fileURLToPath(new URL(`../fixtures/${n}`, import.meta.url)))])

describe('DRM detection', () => {
  it('flags EPUBs with encrypted content', async () => {
    expect(await checkDrm(blob('drm.epub'), 'epub')).toBe('drm')
  })

  it('accepts EPUBs whose only encryption is font obfuscation', async () => {
    expect(await checkDrm(blob('fonts.epub'), 'epub')).toBe('none')
    expect(await checkDrm(blob('sample.epub'), 'epub')).toBe('none')
  })

  it('flags encrypted MOBI and accepts clean ones', async () => {
    expect(await checkDrm(blob('drm.mobi'), 'mobi')).toBe('drm')
    expect(await checkDrm(blob('magi.mobi'), 'mobi')).toBe('none')
    expect(await checkDrm(blob('magi.azw3'), 'azw3')).toBe('none')
  })

  it('flags non-standard PDF security handlers only', async () => {
    expect(await checkDrm(blob('adept.pdf'), 'pdf')).toBe('drm')
    expect(await checkDrm(blob('password.pdf'), 'pdf')).toBe('none') // handled by pdf.js as a password
    expect(await checkDrm(blob('sample.pdf'), 'pdf')).toBe('none')
    expect(pdfBytesDrm('/Encrypt 5 0 R ... /Filter /FOPN_foweb')).toBe('drm')
  })

  it('treats encryption.xml with unknown algorithms as DRM', () => {
    expect(encryptionXmlIsDrm('<EncryptedData><EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#aes256-cbc"/></EncryptedData>')).toBe(true)
    expect(encryptionXmlIsDrm('<EncryptedData><EncryptionMethod Algorithm="http://ns.adobe.com/pdf/enc#RC"/></EncryptedData>')).toBe(false)
    expect(encryptionXmlIsDrm('<encryption/>')).toBe(false)
  })
})
