import { describe, expect, it, vi } from 'vitest'
import type { SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import { deriveSettingsScope } from '../src/client/derived-settings-scope.js'

describe('derived Settings scopes', () => {
  it('projects one shared stable snapshot and delegates the owner lifecycle', async () => {
    let snapshot: SettingsScopeSnapshot<{ mode: string; route: string }> = { status: 'ready', value: { mode: 'fixed', route: 'codex' }, base: {}, user: {}, revision: 3, writable: true, mode: 'host' }
    const set = vi.fn(async () => {}); const unset = vi.fn(async () => {}); const subscribe = vi.fn(() => vi.fn())
    const source = { getSnapshot: () => snapshot, subscribe, set, unset }
    const derived = deriveSettingsScope(source, value => ({ mode: value.mode }))
    const first = derived.getSnapshot()
    expect(first).toBe(derived.getSnapshot())
    expect(first.value).toEqual({ mode: 'fixed' })
    snapshot = { ...snapshot, value: { mode: 'follow-main', route: 'grok' }, revision: 4 }
    expect(derived.getSnapshot()).toMatchObject({ value: { mode: 'follow-main' }, revision: 4 })
    const listener = vi.fn(); derived.subscribe(listener); expect(subscribe).toHaveBeenCalledWith(listener)
    await derived.set('route', 'deepseek'); await derived.unset('route')
    expect(set).toHaveBeenCalledWith('route', 'deepseek'); expect(unset).toHaveBeenCalledWith('route')
  })
})
