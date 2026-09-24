import { describe, expect, it, vi } from 'vitest'
import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import { deriveConfigForm } from '../src/client/derived-config-form.js'

describe('derived ConfigForms', () => {
  it('projects stable snapshots and maps writes to owner fields', async () => {
    type Source = { subagentMode: string; route: string }
    let snapshot: ConfigFormSnapshot<Source> = { status: 'ready', value: { subagentMode: 'fixed', route: 'codex' }, base: {}, user: {}, revision: 3, writable: true, mode: 'host' }
    const set = vi.fn(async () => true)
    const unset = vi.fn(async () => true)
    const subscribe = vi.fn(() => vi.fn())
    const source: ConfigForm<Source> = {
      getSnapshot: () => snapshot,
      subscribe,
      set,
      unset,
      mutate: vi.fn(async () => true),
    }
    const derived = deriveConfigForm(source, value => ({ mode: value.subagentMode }), { mode: 'subagentMode' })
    const first = derived.getSnapshot()
    expect(first).toBe(derived.getSnapshot())
    expect(first.value).toEqual({ mode: 'fixed' })
    snapshot = { ...snapshot, value: { subagentMode: 'follow-main', route: 'grok' }, revision: 4 }
    expect(derived.getSnapshot()).toMatchObject({ value: { mode: 'follow-main' }, revision: 4 })
    const listener = vi.fn()
    derived.subscribe(listener)
    expect(subscribe).toHaveBeenCalledWith(listener)
    await derived.set('mode', 'fixed')
    await derived.unset('mode')
    expect(set).toHaveBeenCalledWith('subagentMode', 'fixed')
    expect(unset).toHaveBeenCalledWith('subagentMode')
  })

  it('surfaces a Host refusal instead of silently accepting a volatile write', async () => {
    const snapshot: ConfigFormSnapshot<{ setting: boolean }> = { status: 'ready', value: { setting: true }, base: {}, user: {}, revision: 3, writable: true, mode: 'host' }
    const source: ConfigForm<{ setting: boolean }> = {
      getSnapshot: () => snapshot,
      subscribe: () => () => undefined,
      set: async () => false,
      unset: async () => false,
      mutate: async () => false,
    }
    const derived = deriveConfigForm(source, value => value, { setting: 'setting' })
    await expect(derived.set('setting', false)).rejects.toThrow('settings-rejected')
  })
})
