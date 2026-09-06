import { describe, expect, it, vi } from 'vitest'
import {
  ANTIGRAVITY_SESSION_READY,
  activateRuntimeLockTarget,
  antigravityRuntimeLockEvent,
  antigravityRuntimeLockView,
  providerSelectable,
  RUNTIME_LOCK_TARGET,
} from '../src/client/runtime-lock.ts'

function ready(seq: number) {
  return {
    type: ANTIGRAVITY_SESSION_READY,
    seq,
    time: 0,
    data: { provider: 'antigravity' },
  } as never
}

describe('Antigravity runtime lock activation', () => {
  it('activates the lock target on the seat Session binding', () => {
    const activate = vi.fn()
    const binding = vi.fn(() => ({ activate }))
    activateRuntimeLockTarget({ binding } as never, 'qa-session' as never)
    expect(binding).toHaveBeenCalledTimes(1)
    expect(binding).toHaveBeenCalledWith('qa-session')
    expect(activate).toHaveBeenCalledTimes(1)
    expect(activate).toHaveBeenCalledWith(RUNTIME_LOCK_TARGET)
  })

  it('derives distinct start ids per startup sequence so replays fold', () => {
    const first = antigravityRuntimeLockEvent.match(ready(11))
    const second = antigravityRuntimeLockEvent.match(ready(27))
    expect(first).toEqual({ id: 'antigravity:11', role: 'start' })
    expect(second).toEqual({ id: 'antigravity:27', role: 'start' })
    expect(first?.id).not.toBe(second?.id)
    const builder = antigravityRuntimeLockView.create()
    expect(builder.replace({ nodes: [], timeline: {} as never })).toBeNull()
    expect(builder.apply({
      upserts: [{ data: 'antigravity' }, { data: 'antigravity' }] as never,
      timeline: {} as never,
    })).toBe('antigravity')
  })

  it('blocks other providers once the locked snapshot is readable', () => {
    const builder = antigravityRuntimeLockView.create()
    const lock = builder.apply({ upserts: [{ data: 'antigravity' }] as never, timeline: {} as never })
    expect(providerSelectable(lock, 'codex')).toBe(false)
    expect(providerSelectable(lock, 'deepseek')).toBe(false)
    expect(providerSelectable(lock, 'antigravity')).toBe(true)
  })
})
