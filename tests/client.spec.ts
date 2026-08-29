import { describe, expect, it, vi } from 'vitest'
import { decodeMainSettings, decodeModelSwitchSettings, MAIN_SETTINGS_ID, MODEL_SWITCH_SETTINGS_ID } from '../src/client-contract.js'

vi.mock('../src/client/picker/install.tsx', () => ({ installComposerPicker: vi.fn() }))

import { apply, inject, name } from '../src/client/index.js'
import { installComposerPicker } from '../src/client/picker/install.tsx'

function ctxWith(settingsMutate: ReturnType<typeof vi.fn>) {
  let registration: Record<string, unknown> | undefined
  const ctx = {
    effect(factory: () => unknown) { factory() },
    locale: { register: vi.fn(() => vi.fn()), bind: vi.fn(() => (key: string) => key) },
    remote: { settings: { mutate: settingsMutate } },
    settingsScope: { bind: () => ({ getSnapshot: () => ({ revision: 7 }), set: vi.fn(), unset: vi.fn() }) },
    slots: { inject(_name: string, factory: () => unknown) { factory() }, register(options: Record<string, unknown>) { registration = options; return vi.fn() } },
  }
  apply(ctx as never)
  return { registration, ctx }
}

describe('Client Settings surface', () => {
  it('decodes unavailable stored choices without hiding them', () => {
    expect(decodeMainSettings({ provider: 'missing', model: 'remember', reasoningEffort: 'custom' })).toEqual({ provider: 'missing', model: 'remember', reasoningEffort: 'custom' })
    expect(decodeModelSwitchSettings({ subagentMode: 'fixed', subagentProvider: 'missing', subagentModel: 'remember' })).toMatchObject({ subagentMode: 'fixed', subagentProvider: 'missing' })
    expect(decodeModelSwitchSettings({ subagentMode: 'follow-main', searchProvider: 'codex', searchModel: 'gpt-search', imageProvider: 'grok', imageModel: 'grok-imagine-1.0', visionProvider: 'hidden' })).toEqual({ subagentMode: 'follow-main', searchProvider: 'codex', searchModel: 'gpt-search', imageProvider: 'grok', imageModel: 'grok-imagine-1.0' })
    expect(decodeModelSwitchSettings({ subagentMode: 'invalid' })).toBeUndefined()
  })
  it('declares the Remote namespaces instead of the removed runtime package', () => {
    expect(name).toBe('dsh-model-switch-client')
    expect(inject).toEqual(['slots', 'locale', 'sessions', 'modelDirectories', 'settingsScope', 'remote', 'remote.settings', 'remote.session'])
  })
  it('registers one localized section and atomically saves the Main row through the settings Remote', async () => {
    const mutate = vi.fn(async () => ({ ok: true as const, value: { revision: 8 } }))
    const { registration } = ctxWith(mutate)
    expect(installComposerPicker).toHaveBeenCalled()
    expect(registration).toMatchObject({ name: 'settings.section', id: 'model-switch', order: 9 })
    const face = (registration?.inject as () => { saveMain(next: unknown, expectedRevision: number): Promise<number> })()
    await face.saveMain({ provider: 'codex', model: 'gpt' }, 7)
    expect(mutate).toHaveBeenCalledWith(MAIN_SETTINGS_ID, [
      { op: 'set', path: ['provider'], value: 'codex' }, { op: 'set', path: ['model'], value: 'gpt' }, { op: 'unset', path: ['reasoningEffort'] },
    ], 7)
  })
  it('fails the whole Main row on a revision conflict', async () => {
    const mutate = vi.fn(async () => ({ ok: false as const, error: { code: 'settings-conflict', message: 'stale revision' } }))
    const { registration } = ctxWith(mutate)
    const face = (registration?.inject as () => { saveMain(next: unknown, expectedRevision: number): Promise<number> })()
    await expect(face.saveMain({ provider: 'a', model: 'b' }, 1)).rejects.toThrow('conflict')
  })
  it('preserves non-conflict Settings rejection diagnostics', async () => {
    const mutate = vi.fn(async () => ({ ok: false as const, error: { code: 'settings-rejected', message: 'schema refused the route' } }))
    const { registration } = ctxWith(mutate)
    const face = (registration?.inject as () => { saveMain(next: unknown, expectedRevision: number): Promise<number> })()
    await expect(face.saveMain({ provider: 'a', model: 'b' }, 1)).rejects.toThrow('settings-rejected: schema refused the route')
  })
})
