import { describe, expect, it } from 'vitest'
import { overSwitchBudget, sameSwitchRoute, shouldProtectSwitch, switchInputBudget } from '../src/switch-compact.ts'

describe('send-time switch protection', () => {
  it('ignores picker-only sameness and the off switch, without a vendor whitelist', () => {
    const from = { provider: 'codex', model: 'gpt-5' }
    const to = { provider: 'grok', model: 'grok-4' }
    expect(shouldProtectSwitch(true, from, to)).toBe(true)
    expect(shouldProtectSwitch(false, from, to)).toBe(false)
    expect(shouldProtectSwitch(true, from, from)).toBe(false)
    expect(shouldProtectSwitch(true, undefined, to)).toBe(false)
    expect(shouldProtectSwitch(true, from, { provider: 'antigravity', model: 'gemini' })).toBe(true)
    expect(sameSwitchRoute(from, { provider: 'codex', model: 'gpt-5' })).toBe(true)
    expect(sameSwitchRoute(from, { provider: 'codex', model: 'gpt-5-1m' })).toBe(false)
  })

  it('reserves output and an estimate margin instead of treating the window as exact', () => {
    expect(switchInputBudget(200)).toBe(96)
    expect(switchInputBudget(200, 80)).toBe(56)
    expect(switchInputBudget(0)).toBeUndefined()
    expect(overSwitchBudget(100, 160)).toBe(false)
    expect(overSwitchBudget(161, 160)).toBe(true)
    expect(overSwitchBudget(1, 0)).toBe(true)
  })
})
