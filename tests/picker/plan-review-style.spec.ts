import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('../../src/client/picker/PlanReviewCard.module.css', import.meta.url), 'utf8')
const mobile = source.slice(source.indexOf('@media (max-width: 720px)'))

describe('Plan Review mobile footer width budget', () => {
  it('wraps the execution picker above the actions on narrow viewports', () => {
    expect(mobile).toContain('flex-wrap: wrap')
    expect(mobile).toContain('flex: 1 1 100%')
    expect(mobile).toContain('max-width: 100%')
    expect(mobile).toContain(`.actions {
    flex: 1 1 100%;`)
    expect(mobile).toContain('justify-content: flex-end')
    expect(mobile).toContain('overflow-wrap: anywhere')
    expect(mobile).toContain('white-space: normal')
  })
})
