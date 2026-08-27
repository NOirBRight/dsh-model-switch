import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('../../src/client/picker/PlanReviewCard.module.css', import.meta.url), 'utf8')
const mobile = source.slice(source.indexOf('@media (max-width: 720px)'))

describe('Plan Review mobile footer width budget', () => {
  it('keeps one action row while allowing labels to wrap inside shrinking controls', () => {
    expect(mobile).toContain(`.bar {
    gap: 4px;`)
    expect(mobile).toContain('flex: 0 1 6.5rem')
    expect(mobile).toContain(`.actions {
    flex: 1 1 auto;
    min-width: 0;
    gap: 4px;`)
    expect(mobile).toContain('overflow-wrap: anywhere')
    expect(mobile).toContain('white-space: normal')
    expect(mobile).not.toContain('flex-wrap: wrap')
  })
})
