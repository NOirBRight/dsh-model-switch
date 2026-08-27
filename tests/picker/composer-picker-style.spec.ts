import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('../../src/client/picker/ComposerPicker.module.css', import.meta.url), 'utf8')

function block(selector: string): string {
  const start = source.indexOf(`${selector} {`)
  if (start < 0) return ''
  const end = source.indexOf('}', start)
  return source.slice(start, end + 1)
}

describe('composer picker mobile sizing', () => {
  it('allows only vertical scrolling inside the menu list', () => {
    expect(block('.list')).toContain('overflow-x: hidden')
    expect(block('.list')).toContain('overflow-y: auto')
  })

  it.each(['.triggerLabel', '.paneTitle', '.modelName', '.description', '.cellLabel', '.cellValue'])(
    'keeps %s readable without ellipsis or single-line clipping',
    (selector) => {
      expect(block(selector)).not.toContain('text-overflow: ellipsis')
      expect(block(selector)).not.toContain('white-space: nowrap')
      expect(block(selector)).toContain('overflow-wrap: anywhere')
    },
  )
})
