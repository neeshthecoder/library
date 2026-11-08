import { describe, expect, it } from 'vitest'
import { chooseTitle, isJunkTitle, titleFromFilename } from '../../src/import/title-clean'

describe('titles', () => {
  it('uses good metadata titles', () => {
    expect(chooseTitle('Middlemarch', 'x.epub')).toBe('Middlemarch')
    expect(chooseTitle('  The   Waves ', 'x.epub')).toBe('The Waves')
  })

  it('rejects placeholder titles', () => {
    for (const t of ['Microsoft Word - draft3.docx', 'untitled', 'Untitled Document', 'C:\\docs\\file', 'report.pdf', '12345', '', null, 'Document']) {
      expect(isJunkTitle(t), String(t)).toBe(true)
    }
    expect(isJunkTitle('Emma')).toBe(false)
  })

  it('cleans filenames', () => {
    expect(chooseTitle('Microsoft Word - draft3.docx', 'the_left-hand_of_darkness (2).pdf')).toBe('The left hand of darkness')
    expect(titleFromFilename('THE_WAVES.epub')).toBe('The waves')
    expect(titleFromFilename('Ursula Le Guin - The Dispossessed.mobi')).toBe('Ursula Le Guin - The Dispossessed')
    expect(titleFromFilename('My.Book.Name.v2.pdf')).toBe('My Book Name v2')
    expect(titleFromFilename('.pdf')).toBe('Untitled book')
  })
})
