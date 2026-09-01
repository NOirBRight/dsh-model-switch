import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('../../src/client/picker/ComposerPicker.module.css', import.meta.url), 'utf8')

function block(selector: string): string {
  const selectorStart = source.indexOf(selector)
  if (selectorStart < 0) return ''
  const start = source.indexOf('{', selectorStart)
  const end = source.indexOf('}', start)
  return source.slice(selectorStart, end + 1)
}

describe('composer picker mobile sizing', () => {
  it('keeps the regular trigger compact and on one line', () => {
    expect(block('.trigger')).toContain('width: fit-content')
    expect(block('.trigger')).toContain('max-width: 256px')
    expect(block('.triggerLabel')).toContain('white-space: nowrap')
    expect(block('.triggerLabel')).toContain('text-overflow: ellipsis')
  })

  it('caps the expanded picker card at the longest-title width', () => {
    expect(block('.menu')).toContain('width: min(280px')
  })

  it('allows only vertical scrolling inside the menu list', () => {
    expect(block('.list')).toContain('overflow-x: hidden')
    expect(block('.list')).toContain('overflow-y: auto')
  })

  it.each([
    '.paneTitle', '.groupTitle', '.status', '.empty', '.error', '.warning',
    '.modelName', '.description',
  ])(
    'keeps %s readable without ellipsis or single-line clipping',
    (selector) => {
      expect(block(selector)).not.toContain('text-overflow: ellipsis')
      expect(block(selector)).not.toContain('white-space: nowrap')
      expect(block(selector)).toContain('overflow-wrap: anywhere')
    },
  )

  it('keeps root summary rows on one line and ellipsizes only the value', () => {
    expect(block('.cell')).toContain('height: 40px')
    expect(block('.cellLabel')).toContain('white-space: nowrap')
    expect(block('.cellLabel')).not.toContain('overflow-wrap: anywhere')
    expect(block('.cellValue')).toContain('white-space: nowrap')
    expect(block('.cellValue')).toContain('text-overflow: ellipsis')
    expect(block('.cellValue')).toContain('overflow: hidden')
  })
})
