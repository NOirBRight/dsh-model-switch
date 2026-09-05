import { describe, expect, it } from 'vitest'
import {
  ANTIGRAVITY_SESSION_READY,
  antigravityRuntimeLockEvent,
  antigravityRuntimeLockView,
  providerSelectable,
} from '../src/client/runtime-lock.ts'

describe('Antigravity runtime lock projection', () => {
  it('starts only from a successful Antigravity session marker', () => {
    expect(antigravityRuntimeLockEvent.match({ type: 'turn/end', data: {} } as never)).toBeNull()
    expect(antigravityRuntimeLockEvent.match({
      type: ANTIGRAVITY_SESSION_READY,
      data: { provider: 'other' },
    } as never)).toBeNull()
    expect(antigravityRuntimeLockEvent.match({
      type: ANTIGRAVITY_SESSION_READY,
      data: { provider: 'antigravity' },
    } as never)).toEqual({ id: 'antigravity', role: 'start' })
  })

  it('keeps the projected provider lock monotonic', () => {
    const builder = antigravityRuntimeLockView.create()
    const node = { data: 'antigravity' } as never

    expect(builder.replace({ nodes: [], timeline: {} as never })).toBeNull()
    expect(builder.apply({ upserts: [node], timeline: {} as never })).toBe('antigravity')
    expect(builder.apply({ upserts: [], timeline: {} as never })).toBe('antigravity')
  })

  it('blocks other providers while preserving Antigravity controls', () => {
    expect(providerSelectable(null, 'codex')).toBe(true)
    expect(providerSelectable('antigravity', 'codex')).toBe(false)
    expect(providerSelectable('antigravity', 'antigravity')).toBe(true)
  })
})
