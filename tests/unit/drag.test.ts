import { describe, expect, it } from 'vitest'
import { dragReducer, initialDrag, type DragEvent_ } from '../../src/import/drag-overlay'

const run = (events: DragEvent_[]) => events.reduce(dragReducer, initialDrag)
const enter = { type: 'enter', files: true } as const
const leave = { type: 'leave', files: true } as const

describe('dragReducer', () => {
  it('shows on enter and stays visible while crossing child elements', () => {
    expect(run([enter]).visible).toBe(true)
    // entering a child fires enter(child) before leave(parent)
    expect(run([enter, enter, leave]).visible).toBe(true)
    expect(run([enter, enter, leave, enter, leave]).visible).toBe(true)
  })

  it('hides when the drag leaves the window', () => {
    expect(run([enter, enter, leave, leave])).toEqual(initialDrag)
  })

  it('never goes negative on extra leaves', () => {
    expect(run([leave, leave, enter]).count).toBe(1)
  })

  it('resets on drop, dragend, and the watchdog (missed dragleave)', () => {
    expect(run([enter, enter, { type: 'drop' }])).toEqual(initialDrag)
    expect(run([enter, { type: 'end' }])).toEqual(initialDrag)
    expect(run([enter, enter, leave, { type: 'timeout' }])).toEqual(initialDrag)
  })

  it('ignores non-file drags', () => {
    expect(run([{ type: 'enter', files: false }])).toEqual(initialDrag)
    expect(run([enter, { type: 'leave', files: false }]).count).toBe(1)
  })
})
