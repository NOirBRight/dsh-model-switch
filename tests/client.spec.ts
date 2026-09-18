import { describe, expect, it, vi } from 'vitest'
import { decodeMainSettings, decodeModelSwitchSettings, MAIN_SETTINGS_ID, MODEL_SWITCH_SETTINGS_ID, subagentModeForEnabled } from '../src/client-contract.js'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => {
  const Stub = () => null
  return {
    Button: Stub, Input: Stub, Toast: Stub, MarkdownText: Stub,
    IconCheckOutline16: Stub, IconChevronDownOutline14: Stub, IconChevronLeftOutline14: Stub,
    IconChevronRightOutline14: Stub, IconCloseOutline16: Stub, IconSearchOutline16: Stub, IconWarningOutline16: Stub,
  }
})

vi.mock('../src/client/picker/install.tsx', async importOriginal => ({
  ...await importOriginal<typeof import('../src/client/picker/install.tsx')>(), installComposerPicker: vi.fn(),
}))

import { apply, inject, name } from '../src/client/index.js'
import { installComposerPicker } from '../src/client/picker/install.tsx'

function ctxWith(settingsMutate: ReturnType<typeof vi.fn>) {
  let registration: Record<string, unknown> | undefined
  const directoryMounts: Array<(scope: unknown) => unknown> = []
  const ctx = {
    inject: (_deps: string[], callback: (scope: unknown) => unknown) => { directoryMounts.push(callback) },
    effect(factory: () => unknown) { factory() },
    locale: { register: vi.fn(() => vi.fn()), bind: vi.fn(() => (key: string) => key) },
    remote: { settings: { mutate: settingsMutate }, session: { modelCatalog: vi.fn(async () => ({ ok: true, value: { groups: [{ id: 'codex', name: 'Codex', models: [] }, { id: 'new-native', name: 'Native', models: [] }] } })) } },
    settingsScope: { bind: () => ({ getSnapshot: () => ({ revision: 7, value: { order: ['native-card', 'llm-codex'] } }), subscribe: () => () => undefined, set: vi.fn(), unset: vi.fn() }) },
    slots: { inject(_name: string, factory: () => unknown) { factory() }, register(options: Record<string, unknown>) { registration = options; return vi.fn() } },
  }
  apply(ctx as never)
  return { registration, ctx, directoryMounts }
}

describe('Client Settings surface', () => {
  it('refreshes catalog order and role when the optional directory mounts and unmounts', async () => {
    const { registration, directoryMounts } = ctxWith(vi.fn())
    const face = (registration!.inject as () => {
      loadCatalog(): Promise<Array<{ id: string }>>
      providerRoleOf(key: string): string
      subscribeProviderOrder(listener: () => void): () => void
    })()
    expect((await face.loadCatalog()).map(group => group.id)).toEqual(['codex', 'new-native'])
    const changed = vi.fn()
    const stop = face.subscribeProviderOrder(changed)
    const disposers: Array<() => void> = []
    const listeners = new Set<() => void>()
    const directory = {
      roleOf: (key: string) => key === 'native-card' ? 'agent' : 'llm',
      catalogRoutes: () => ({ codex: 'llm-codex', 'new-native': 'native-card' }),
      subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    }
    for (const mount of directoryMounts) mount({
      get: () => directory,
      effect: (register: () => () => void) => { disposers.push(register()) },
    })
    expect(changed).toHaveBeenCalledOnce()
    expect((await face.loadCatalog()).map(group => group.id)).toEqual(['new-native', 'codex'])
    expect(face.providerRoleOf('new-native')).toBe('agent')
    for (const dispose of disposers.reverse()) dispose()
    expect(listeners.size).toBe(0)
    expect(changed).toHaveBeenCalledTimes(2)
    expect((await face.loadCatalog()).map(group => group.id)).toEqual(['codex', 'new-native'])
    expect(face.providerRoleOf('new-native')).toBe('llm')
    stop()
  })

  it('keeps catalog loading available with an older directory lacking catalogRoutes', async () => {
    const { registration, directoryMounts } = ctxWith(vi.fn())
    const face = (registration!.inject as () => { loadCatalog(): Promise<Array<{ id: string }>> })()
    const directory = {
      roleOf: () => 'llm',
      subscribe: () => () => undefined,
    }
    const disposers: Array<() => void> = []
    for (const mount of directoryMounts) mount({
      get: () => directory,
      effect: (register: () => () => void) => { disposers.push(register()) },
    })
    expect((await face.loadCatalog()).map(group => group.id)).toEqual(['codex', 'new-native'])
    for (const dispose of disposers.reverse()) dispose()
  })

  it('decodes unavailable stored choices without hiding them', () => {
    expect(decodeMainSettings({ provider: 'missing', model: 'remember', reasoningEffort: 'custom' })).toEqual({ provider: 'missing', model: 'remember', reasoningEffort: 'custom' })
    expect(decodeModelSwitchSettings({ subagentMode: 'fixed', subagentProvider: 'missing', subagentModel: 'remember' })).toMatchObject({ subagentMode: 'fixed', subagentProvider: 'missing' })
    expect(decodeModelSwitchSettings({ subagentMode: 'follow-main', searchProvider: 'codex', searchModel: 'gpt-search', imageProvider: 'grok', imageModel: 'grok-imagine-1.0', visionProvider: 'hidden' })).toEqual({ subagentMode: 'follow-main', compactOnSwitch: true, searchProvider: 'codex', searchModel: 'gpt-search', imageProvider: 'grok', imageModel: 'grok-imagine-1.0' })
    expect(decodeModelSwitchSettings({ subagentMode: 'invalid' })).toBeUndefined()
    expect(subagentModeForEnabled(true)).toBe('fixed')
    expect(subagentModeForEnabled(false)).toBe('follow-main')
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
