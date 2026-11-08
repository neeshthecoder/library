// Generates small test fixtures in tests/fixtures. Kindle fixtures (magi.*)
// are public-domain Project Gutenberg files committed alongside.
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { zipSync, strToU8 } from 'fflate'

const out = (name) => new URL(`../tests/fixtures/${name}`, import.meta.url)

// --- PNG ---------------------------------------------------------------
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td))
  return Buffer.concat([len, td, c])
}
/** Cover: dark green with an orange title block. */
function coverPng(w = 120, h = 180) {
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3
      const orange = y > h * 0.3 && y < h * 0.45 && x > w * 0.15 && x < w * 0.85
      const [r, g, b] = orange ? [224, 122, 63] : [36, 65, 58]
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

// --- EPUB --------------------------------------------------------------
const para = (n) =>
  `<p>This is paragraph ${n} of the sample book. It exists so the reader has enough text to paginate across several spreads, and so that reading positions can be saved and restored in tests.</p>`

function epub({ title, chapters = 12, cover = true, extraFiles = {}, script = false }) {
  const items = []
  const spine = []
  const files = {}
  for (let i = 1; i <= chapters; i++) {
    const id = `ch${i}`
    items.push(`<item id="${id}" href="${id}.xhtml" media-type="application/xhtml+xml"${script && i === 1 ? ' properties="scripted"' : ''}/>`)
    spine.push(`<itemref idref="${id}"/>`)
    const body = Array.from({ length: 14 }, (_, k) => para(k + 1)).join('\n')
    const js = script && i === 1
      ? `<script>try{window.top.__epubScriptRan=true}catch(e){};document.title='SCRIPT RAN';</script><script src="evil.js"></script>`
      : ''
    files[`OEBPS/${id}.xhtml`] = strToU8(`<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Chapter ${i}</title>${js}</head>
<body><h2 id="c${i}">Chapter ${i}</h2>${body}</body></html>`)
  }
  if (script) {
    files['OEBPS/evil.js'] = strToU8('try{window.top.__epubScriptRan=true}catch(e){}')
    items.push('<item id="evil" href="evil.js" media-type="text/javascript"/>')
  }
  if (cover) {
    files['OEBPS/cover.png'] = coverPng()
    items.push('<item id="cover-image" href="cover.png" media-type="image/png" properties="cover-image"/>')
  }
  items.push('<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>')
  files['OEBPS/nav.xhtml'] = strToU8(`<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body>
<nav epub:type="toc"><ol>${Array.from({ length: chapters }, (_, i) => `<li><a href="ch${i + 1}.xhtml">Chapter ${i + 1}</a></li>`).join('')}</ol></nav></body></html>`)
  files['OEBPS/content.opf'] = strToU8(`<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="uid">urn:uuid:12345678-1234-1234-1234-1234567890ab</dc:identifier>
<dc:title>${title}</dc:title><dc:language>en</dc:language>
<meta property="dcterms:modified">2026-01-01T00:00:00Z</meta>
${cover ? '<meta name="cover" content="cover-image"/>' : ''}
</metadata><manifest>${items.join('')}</manifest><spine>${spine.join('')}</spine></package>`)
  files['META-INF/container.xml'] = strToU8(`<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`)
  Object.assign(files, extraFiles)
  // mimetype must be first and stored
  return zipSync({ mimetype: [strToU8('application/epub+zip'), { level: 0 }], ...files })
}

const encXml = (algo, uri) => strToU8(`<?xml version="1.0"?>
<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:enc="http://www.w3.org/2001/04/xmlenc#">
<enc:EncryptedData><enc:EncryptionMethod Algorithm="${algo}"/><enc:CipherData><enc:CipherReference URI="${uri}"/></enc:CipherData></enc:EncryptedData></encryption>`)

writeFileSync(out('sample.epub'), epub({ title: 'Middlemarch' }))
writeFileSync(out('nocover.epub'), epub({ title: 'A Book Without a Cover', cover: false, chapters: 3 }))
writeFileSync(out('script.epub'), epub({ title: 'Scripted Book', chapters: 2, script: true }))
writeFileSync(out('drm.epub'), epub({ title: 'Locked Book', chapters: 2, extraFiles: { 'META-INF/encryption.xml': encXml('http://www.w3.org/2001/04/xmlenc#aes128-cbc', 'OEBPS/ch1.xhtml') } }))
writeFileSync(out('fonts.epub'), epub({ title: 'Book With Fonts', chapters: 2, extraFiles: {
  'META-INF/encryption.xml': encXml('http://www.idpf.org/2008/embedding', 'OEBPS/font.otf'),
  'OEBPS/font.otf': strToU8('not really a font'),
} }))
writeFileSync(out('book.zip'), readFileSync(out('sample.epub')))
writeFileSync(out('notes.docx'), zipSync({ '[Content_Types].xml': strToU8('<Types/>'), 'word/document.xml': strToU8('<w:document/>') }))

// --- PDF ---------------------------------------------------------------
function pdf({ pages = 9, title }) {
  const objs = []
  const add = (s) => (objs.push(s), objs.length)
  const catalog = add('') // placeholder 1
  const pagesId = add('') // placeholder 2
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  const kids = []
  for (let i = 1; i <= pages; i++) {
    const text = `BT /F1 28 Tf 72 700 Td (Page ${i}) Tj ET BT /F1 12 Tf 72 660 Td (Sample text on page ${i} for selection tests.) Tj ET`
    const content = add(`<< /Length ${text.length} >>\nstream\n${text}\nendstream`)
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`))
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`
  objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${pages} >>`
  const info = add(`<< /Title (${title}) /Producer (fixtures) >>`)
  let body = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'
  const offsets = []
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(body, 'latin1'))
    body += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = Buffer.byteLength(body, 'latin1')
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  body += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(body, 'latin1')
}
writeFileSync(out('sample.pdf'), pdf({ title: 'A Sample PDF' }))
writeFileSync(out('the_left-hand_of_darkness (2).pdf'), pdf({ pages: 2, title: 'Microsoft Word - draft3.docx' }))
// A PDF claiming an Adobe ADEPT security handler
writeFileSync(out('adept.pdf'), Buffer.concat([pdf({ pages: 1, title: 'Adept' }), Buffer.from('\n% trailer2\n<< /Encrypt << /Filter /EBX_HANDLER /V 2 >> >>\n', 'latin1')]))

// --- MOBI with encryption flag -------------------------------------------
if (existsSync(out('magi.mobi'))) {
  const b = Buffer.from(readFileSync(out('magi.mobi')))
  const r0 = b.readUInt32BE(78)
  b.writeUInt16BE(2, r0 + 12)
  writeFileSync(out('drm.mobi'), b)
}
console.log('fixtures written')
