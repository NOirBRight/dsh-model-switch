import { describe, expect, it, vi } from 'vitest'
import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import { MAIN_DEFAULT_CONFIG_ID, MODEL_SWITCH_CONFIG_ID, PROVIDERS_CONFIG_ID, MainSettingsConflictError, subagentModeForEnabled, type MainSettingsView, type ModelSwitchSettingsView } from '../src/client-contract.js'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => {
  const Stub = () => null
  return {
    Button: Stub, Input: Stub, Toast: Stub, MarkdownText: Stub,
    IconCheckOutlineRegular: Stub, IconChevronDownOutlineRegular: Stub, IconChevronLeftOutlineRegular: Stub,
    IconChevronRightOutlineRegular: Stub, IconCloseOutlineRegular: Stub, IconSearchOutlineRegular: Stub, IconWarningOutlineRegular: Stub,
  }
})

vi.mock('../src/client/picker/install.tsx', async importOriginal => ({
  ...await importOriginal<typeof import('../src/client/picker/install.tsx')>(), installComposerPicker: vi.fn(),
}))

import { apply, inject, name } from '../src/client/index.js'
import { installComposerPicker } from '../src/client/picker/install.tsx'

function form<T>(value: T, revision = 7) {
  let snapshot: ConfigFormSnapshot<T> = { status: 'ready', value, base: {}, user: {}, revision, writable: true, mode: 'host' }
  const listeners = new Set<() => void>()
  const mutate = vi.fn(async (_ops: Parameters<ConfigForm<T>['mutate']>[0], _revision?: number) => true)
  const set = vi.fn(async (_field: string, _value: unknown) => true)
  const unset = vi.fn(async (_field: string) => true)
  const result: ConfigForm<T> = {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
    set,
    unset,
    async mutate(...args: Parameters<ConfigForm<T>['mutate']>) {
      const accepted = await mutate(...args)
      if (accepted) {
        snapshot = { ...snapshot, revision: (snapshot.revision ?? 0) + 1 }
        for (const listener of listeners) listener()
      }
      return accepted
    },
  }
  return {
    form: result,
    mutate,
    set,
    unset,
    setRevision(next: number) { snapshot = { ...snapshot, revision: next } },
  }
}

function ctxWith(mainMutation: ConfigForm<MainSettingsView>['mutate'] = async () => true) {
  let registration: Record<string, unknown> | undefined
  const directoryMounts: Array<(scope: unknown) => unknown> = []
  const main = form<MainSettingsView>({ provider: 'deepseek', model: 'deep-chat' })
  const owned = form<ModelSwitchSettingsView>({ subagentMode: 'follow-main', compactOnSwitch: true })
  const providers = form<{ order: string[] }>({ order: ['native-card', 'llm-codex'] })
  const rpc = { call: vi.fn(async () => ({ ok: true as const, value: { revision: 0, capabilities: { searchProviderAdapters: { available: true, providers: [], catalog: [] } } } })) }
  const ctx = {
    inject: (_deps: string[], callback: (scope: unknown) => unknown) => { directoryMounts.push(callback) },
    effect(factory: () => unknown) { factory() },
    locale: { register: vi.fn(() => vi.fn()), bind: vi.fn(() => (key: string) => key) },
    remote: { session: { modelCatalog: vi.fn(async () => ({ ok: true, value: { groups: [{ id: 'codex', name: 'Codex', models: [] }, { id: 'new-native', name: 'Native', models: [] }] } })) } },
    configForms: {
      get: vi.fn((id: string) => id === MAIN_DEFAULT_CONFIG_ID ? main.form : id === MODEL_SWITCH_CONFIG_ID ? owned.form : providers.form),
    },
    slots: { inject(_name: string, factory: () => unknown) { factory() }, register(options: Record<string, unknown>) { registration = options; return vi.fn() } },
    get: vi.fn((name: string) => name === 'connection' ? { rpc } : undefined),
  }
  main.mutate.mockImplementation(async (...args) => {
    const accepted = await mainMutation(...args)
    return accepted
  })
  apply(ctx as never)
  return { registration, ctx, directoryMounts, main, owned, rpc }
}

describe('Client ConfigForms surface', () => {
  it('refreshes catalog order and role when the optional directory mounts and unmounts', async () => {
    const { registration, directoryMounts } = ctxWith()
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
    const { registration, directoryMounts } = ctxWith()
    const face = (registration!.inject as () => { loadCatalog(): Promise<Array<{ id: string }>> })()
    const directory = { roleOf: () => 'llm', subscribe: () => () => undefined }
    const disposers: Array<() => void> = []
    for (const mount of directoryMounts) mount({
      get: () => directory,
      effect: (register: () => () => void) => { disposers.push(register()) },
    })
    expect((await face.loadCatalog()).map(group => group.id)).toEqual(['codex', 'new-native'])
    for (const dispose of disposers.reverse()) dispose()
  })

  it('preserves the Client entry dependencies and uses actual Loader entry ids', () => {
    const { ctx } = ctxWith()
    expect(name).toBe('dsh-model-switch-client')
    expect(inject).toEqual(['slots', 'locale', 'sessions', 'modelDirectories', 'configForms', 'remote', 'remote.session'])
    expect(ctx.configForms.get).toHaveBeenCalledWith(MAIN_DEFAULT_CONFIG_ID)
    expect(ctx.configForms.get).toHaveBeenCalledWith(MODEL_SWITCH_CONFIG_ID)
    expect(ctx.configForms.get).toHaveBeenCalledWith(PROVIDERS_CONFIG_ID)
  })

  it('saves the Main row atomically through ConfigForm and maps false refusal to conflict', async () => {
    const { registration, main, rpc } = ctxWith()
    expect(installComposerPicker).toHaveBeenCalled()
    expect(registration).toMatchObject({ name: 'settings.section', id: 'model-switch', order: 9 })
    const face = (registration?.inject as () => {
      saveMain(next: MainSettingsView, expectedRevision: number): Promise<number>
      loadCapabilities(revision?: number, signal?: AbortSignal): Promise<unknown>
      setCompactOnSwitch(value: boolean): Promise<void>
    })()
    await expect(face.saveMain({ provider: 'codex', model: 'gpt' }, 7)).resolves.toBe(8)
    expect(main.mutate).toHaveBeenCalledWith([
      { op: 'set', path: ['provider'], value: 'codex' },
      { op: 'set', path: ['model'], value: 'gpt' },
      { op: 'unset', path: ['reasoningEffort'] },
    ], 7)
    await face.loadCapabilities(4)
    expect(rpc.call).toHaveBeenCalledWith('/api', 'plugin-rpc/model-switch', { endpoint: 'capabilities', payload: { revision: 4 } }, undefined)
    const rejected = ctxWith(vi.fn(async () => false))
    const rejectedFace = (rejected.registration?.inject as () => { saveMain(next: MainSettingsView, expectedRevision: number): Promise<number> })()
    await expect(rejectedFace.saveMain({ provider: 'codex', model: 'gpt' }, 7)).rejects.toThrow('settings-rejected')
    rejected.main.setRevision(8)
    await expect(rejectedFace.saveMain({ provider: 'codex', model: 'gpt' }, 7)).rejects.toBeInstanceOf(MainSettingsConflictError)
  })

  it('maps compact switch edits through the owned ConfigForm and surfaces refusal', async () => {
    const { registration, owned } = ctxWith()
    const face = (registration?.inject as () => { setCompactOnSwitch(value: boolean): Promise<void> })()
    await expect(face.setCompactOnSwitch(false)).resolves.toBeUndefined()
    expect(owned.set).toHaveBeenCalledWith('compactOnSwitch', false)
    owned.set.mockResolvedValue(false)
    await expect(face.setCompactOnSwitch(true)).rejects.toThrow('settings-rejected')
    expect(subagentModeForEnabled(true)).toBe('fixed')
    expect(subagentModeForEnabled(false)).toBe('follow-main')
  })
})
