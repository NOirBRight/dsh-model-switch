import { describe, expect, it, vi } from 'vitest'
import { decodeMainSettings, decodeModelSwitchSettings, MAIN_SETTINGS_ID, MODEL_SWITCH_SETTINGS_ID } from '../src/client-contract.js'
import { apply, inject, name } from '../src/client/index.js'

describe('Client Settings surface', () => {
  it('decodes unavailable stored choices without hiding them', () => {
    expect(decodeMainSettings({ provider: 'missing', model: 'remember', reasoningEffort: 'custom' })).toEqual({ provider: 'missing', model: 'remember', reasoningEffort: 'custom' })
    expect(decodeModelSwitchSettings({ subagentMode: 'fixed', subagentProvider: 'missing', subagentModel: 'remember' })).toMatchObject({ subagentMode: 'fixed', subagentProvider: 'missing' })
    expect(decodeModelSwitchSettings({ subagentMode: 'follow-main', searchProvider: 'hidden', imageProvider: 'hidden', visionProvider: 'hidden' })).toEqual({ subagentMode: 'follow-main' })
    expect(decodeModelSwitchSettings({ subagentMode: 'invalid' })).toBeUndefined()
  })
  it('registers one localized section and atomically saves the Main row', async () => {
    const namespaces: string[] = []
    let registration: Record<string, unknown> | undefined
    const mutate = vi.fn(async () => ({ result: { ok: true, value: { revision: 8 } } }))
    const ctx = {
      effect(factory: () => unknown) { factory() },
      locale: { register: vi.fn(() => vi.fn()), bind: vi.fn(() => (key: string) => key) },
      get: () => ({ api: { settings: { mutate } } }),
      settingsScope: { bind(spec: { namespace: string }) { namespaces.push(spec.namespace); return { getSnapshot: () => ({ revision: 7 }), set: vi.fn(), unset: vi.fn() } } },
      slots: { inject(_name: string, factory: () => unknown) { factory() }, register(options: Record<string, unknown>) { registration = options; return vi.fn() } },
    }
    apply(ctx as never)
    expect(name).toBe('dsh-model-switch-client')
    expect(inject).toEqual(['slots', 'locale', 'settingsScope', 'connection'])
    expect(namespaces).toEqual([MAIN_SETTINGS_ID, MODEL_SWITCH_SETTINGS_ID])
    expect(registration).toMatchObject({ name: 'settings.section', id: 'model-switch', order: 9 })
    const face = (registration?.inject as () => { saveMain(next: unknown, expectedRevision: number): Promise<number> })()
    await face.saveMain({ provider: 'codex', model: 'gpt' }, 7)
    expect(mutate).toHaveBeenCalledWith({ ns: MAIN_SETTINGS_ID, expectedRevision: 7, ops: [
      { op: 'set', path: ['provider'], value: 'codex' }, { op: 'set', path: ['model'], value: 'gpt' }, { op: 'unset', path: ['reasoningEffort'] },
    ] })
  })
  it('fails the whole Main row on a revision conflict', async () => {
    let registration: Record<string, unknown> | undefined
    const ctx = {
      effect(factory: () => unknown) { factory() }, locale: { register: () => vi.fn(), bind: () => (key: string) => key },
      get: () => ({ api: { settings: { mutate: async () => ({ result: { ok: false, error: { code: 'settings-conflict', message: 'stale revision', details: { ns: MAIN_SETTINGS_ID, expected: 1, actual: 2 } } } }) } } }),
      settingsScope: { bind: () => ({ getSnapshot: () => ({ revision: 1 }) }) },
      slots: { inject(_name: string, factory: () => unknown) { factory() }, register(options: Record<string, unknown>) { registration = options; return vi.fn() } },
    }
    apply(ctx as never)
    const face = (registration?.inject as () => { saveMain(next: unknown, expectedRevision: number): Promise<number> })()
    await expect(face.saveMain({ provider: 'a', model: 'b' }, 1)).rejects.toThrow('conflict')
  })
  it('preserves non-conflict Settings rejection diagnostics', async () => {
    let registration: Record<string, unknown> | undefined
    const ctx = {
      effect(factory: () => unknown) { factory() }, locale: { register: () => vi.fn(), bind: () => (key: string) => key },
      get: () => ({ api: { settings: { mutate: async () => ({ result: { ok: false, error: { code: 'settings-rejected', message: 'schema refused the route', details: { ns: MAIN_SETTINGS_ID } } } }) } } }),
      settingsScope: { bind: () => ({ getSnapshot: () => ({ revision: 1 }) }) },
      slots: { inject(_name: string, factory: () => unknown) { factory() }, register(options: Record<string, unknown>) { registration = options; return vi.fn() } },
    }
    apply(ctx as never)
    const face = (registration?.inject as () => { saveMain(next: unknown, expectedRevision: number): Promise<number> })()
    await expect(face.saveMain({ provider: 'a', model: 'b' }, 1)).rejects.toThrow('settings-rejected: schema refused the route')
  })
})
