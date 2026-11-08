const JUNK = [
  /^\s*$/,
  /^untitled(\s*document)?$/i,
  /^(microsoft\s+)?(word|powerpoint|excel)\s*-\s*/i,
  /\.(docx?|pptx?|xlsx?|pdf|epub|mobi|azw3?|txt|rtf|odt|pages|indd|tex|dvi|ps|qxd)$/i,
  /^[a-z]:\\|^\/|\\|\//i,
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  /^(title|document|book|unknown|none|null|n\/a)$/i,
  /^[\d\s_.-]+$/,
]

/** True when a metadata title looks like a placeholder rather than a real title. */
export function isJunkTitle(t: string | null | undefined): boolean {
  if (!t) return true
  const s = t.trim()
  return s.length < 2 || JUNK.some((re) => re.test(s))
}

/** Turns a filename into a readable title. */
export function titleFromFilename(name: string): string {
  let s = name.replace(/\.[a-z0-9]{2,5}$/i, '')
  s = s.replace(/\s*\(\d+\)\s*$/, '') // "book (2)"
  s = s.replace(/\s*-\s*copy$/i, '')
  s = s.replace(/[_.]+/g, ' ').replace(/(?<=\w)-(?=\w)/g, ' ').replace(/\s+-\s+/g, ' - ')
  s = s.replace(/\s+/g, ' ').trim()
  if (!s) return 'Untitled book'
  const letters = s.replace(/[^a-z]/gi, '')
  if (letters && (letters === letters.toLowerCase() || letters === letters.toUpperCase())) {
    s = s.toLowerCase()
    s = s.charAt(0).toUpperCase() + s.slice(1)
  }
  return s
}

/** Metadata title if usable, else the cleaned filename. */
export function chooseTitle(metaTitle: string | null | undefined, filename: string): string {
  const t = metaTitle?.replace(/\s+/g, ' ').trim()
  return t && !isJunkTitle(t) ? t : titleFromFilename(filename)
}
