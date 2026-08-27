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
  it('allows only vertical scrolling inside the menu list', () => {
    expect(block('.list')).toContain('overflow-x: hidden')
    expect(block('.list')).toContain('overflow-y: auto')
  })

  it.each([
    '.triggerLabel', '.paneTitle', '.groupTitle', '.status', '.empty', '.error', '.warning',
    '.modelName', '.description', '.cellLabel', '.cellValue',
  ])(
    'keeps %s readable without ellipsis or single-line clipping',
    (selector) => {
      expect(block(selector)).not.toContain('text-overflow: ellipsis')
      expect(block(selector)).not.toContain('white-space: nowrap')
      expect(block(selector)).toContain('overflow-wrap: anywhere')
    },
  )
})
