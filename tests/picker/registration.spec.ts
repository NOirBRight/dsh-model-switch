import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => {
  const Stub = () => null
  return {
    Button: Stub, Input: Stub, Toast: Stub, MarkdownText: Stub,
    IconCheckOutlineRegular: Stub, IconChevronDownOutlineRegular: Stub, IconChevronLeftOutlineRegular: Stub,
    IconChevronRightOutlineRegular: Stub, IconCloseOutlineRegular: Stub, IconSearchOutlineRegular: Stub, IconWarningOutlineRegular: Stub,
  }
})

import { installComposerPicker, providerOrderStore } from '../../src/client/picker/install.tsx'

function bench(strictOptionalLookup = false) {
  const entries: Array<{ spec: Record<string, unknown>, component: unknown }> = []
  const injections: string[][] = []
  const directory = {
    store: { subscribe: vi.fn(), getSnapshot: vi.fn() },
    load: vi.fn(async () => undefined),
    select: vi.fn(async () => undefined),
  }
  const mainForm = {
    getSnapshot: () => ({ status: 'ready', mode: 'host', writable: true, value: { provider: 'deepseek', model: 'deep-chat' }, revision: 1 }),
    subscribe: () => () => undefined,
    mutate: vi.fn(async () => true),
  }
  const providerForm = {
    getSnapshot: () => ({ status: 'ready', value: { order: [] } }),
    subscribe: () => () => undefined,
  }
  const raw: Record<string, unknown> = {
    providerDirectory: {
      roleOf: (key: string) => ['antigravity', 'cursor-agent'].includes(key) ? 'agent' : 'llm',
      nativeBindings: () => [
        { provider: 'antigravity', channel: 'plugin-rpc/antigravity', endpoint: 'activity/binding' },
        { provider: 'cursor-agent', channel: 'plugin-rpc/cursor', endpoint: 'activity/binding' },
      ],
      catalogRoutes: () => ({ antigravity: 'antigravity', 'cursor-agent': 'cursor-agent' }),
      subscribe: () => () => undefined,
    },
    locale: { register: vi.fn(() => () => undefined) },
    slots: {
      inject: (_name: string, register: () => unknown) => register(),
      register: (spec: Record<string, unknown>, component: unknown) => {
        entries.push({ spec, component })
        return () => undefined
      },
    },
    uiConversation: { views: { register: vi.fn(() => vi.fn()) }, events: { register: vi.fn(() => vi.fn()) } },
    modelDirectories: { directoryFor: vi.fn(() => directory) },
    sessions: { subagentAddress: vi.fn(() => undefined) },
    configForms: { get: (id: string) => id === 'agent-default-model' ? mainForm : providerForm },
    effect: (register: () => unknown) => register(),
    get: vi.fn(() => undefined),
  }
  let directInteractionReads = 0
  const ctx = strictOptionalLookup
    ? new Proxy(raw, {
        get(target, property, receiver) {
          if (property === 'interactionOperations') {
            directInteractionReads += 1
            throw new Error('cannot get property interactionOperations')
          }
          return Reflect.get(target, property, receiver)
        },
      })
    : raw
  ctx.inject = (services: string[], register: (scope: unknown) => unknown) => {
    injections.push([...services])
    return services.includes('providerDirectory')
      ? register({ ...ctx, get: (name: string) => name === 'providerDirectory' ? raw.providerDirectory : undefined })
      : register(ctx)
  }
  installComposerPicker(ctx as never)
  return { entries, injections, raw, directory, mainForm, directInteractionReads: () => directInteractionReads }
}

describe('composer picker seat ownership', () => {
  it.each([['antigravity', 'codex'], ['codex', 'antigravity'], ['cursor-agent', 'codex'], ['codex', 'cursor-agent']])('rechecks pending first-turn state before %s to %s selection', async (current, target) => {
    const { entries, raw, directory } = bench()
    let session = { blank: true, running: false, awaitingFirstTurn: false }
    Object.assign(raw.sessions as object, { get: () => ({ getSnapshot: () => session }) })
    raw.get = (name: string) => name === 'connection'
      ? { rpc: { call: async () => ({ ok: true, value: { provider: null } }) } }
      : name === 'providerDirectory' ? { reader: () => ({}), roleOf: (key: string) => key === 'antigravity' ? 'agent' : 'llm' } : undefined
    directory.store.getSnapshot.mockReturnValue({ current: { provider: current, model: 'first' } })
    const model = entries.find(({ spec }) => spec.name === 'conversation.input.model')!
    const face = (model.spec.inject as (id: string) => { select(selection: { provider: string; model: string }): Promise<boolean> })('session-1')
    const choice = { provider: target, model: 'second' }
    await expect(face.select(choice)).resolves.toBe(true)
    directory.select.mockClear()
    session = { blank: true, running: false, awaitingFirstTurn: true }
    await expect(face.select(choice)).resolves.toBe(false)
    session = { blank: true, running: true, awaitingFirstTurn: false }
    await expect(face.select(choice)).resolves.toBe(false)
    session = { blank: true, running: false, awaitingFirstTurn: false, pendingSubmissions: [{ requestId: 'p1' }] }
    await expect(face.select(choice)).resolves.toBe(false)
    expect(directory.select).not.toHaveBeenCalled()
    session = { blank: true, running: false, awaitingFirstTurn: false, pendingSubmissions: [] }
    await expect(face.select(choice)).resolves.toBe(true)
  })

  it('refuses remote memory-only model selection rather than persisting a new profile-wide default', async () => {
    const { entries, raw, directory, mainForm } = bench()
    mainForm.getSnapshot = () => ({ status: 'ready', mode: 'memory', writable: false, value: { provider: 'deepseek', model: 'deep-chat' }, revision: 1 })
    raw.get = (name: string) => name === 'connection'
      ? { rpc: { call: async () => ({ ok: true, value: { provider: null } }) } }
      : undefined
    directory.store.getSnapshot.mockReturnValue({ current: { provider: 'deepseek', model: 'deep-chat' } })
    const model = entries.find(({ spec }) => spec.name === 'conversation.input.model')!
    const face = (model.spec.inject as (id: string) => { select(selection: { provider: string; model: string }): Promise<boolean> })('session-1')
    await expect(face.select({ provider: 'codex', model: 'gpt-switched' })).resolves.toBe(false)
    expect(directory.select).not.toHaveBeenCalled()
    expect(mainForm.mutate).not.toHaveBeenCalled()
  })

  it('disables the remote memory-only composer picker with an actionable reason', async () => {
    const { entries, directory, mainForm } = bench()
    const remote = { status: 'unavailable', mode: 'memory', writable: false, value: undefined, revision: undefined }
    mainForm.getSnapshot = () => remote
    const snapshot = { current: { provider: 'deepseek', model: 'deep-chat' }, routable: true, groups: [], failures: [], status: 'ready', error: null }
    directory.store.getSnapshot.mockReturnValue(snapshot)
    directory.store.subscribe.mockReturnValue(() => undefined)
    const model = entries.find(({ spec }) => spec.name === 'conversation.input.model')!
    const face = (model.spec.inject as (sessionId: string) => Record<string, unknown>)('session-1')
    const props = {
      ...face,
      locked: false,
      t: (key: string) => key,
      useDirectory: (select: (value: typeof snapshot) => unknown) => select(snapshot),
      useProviderOrder: (select: (value: string[]) => unknown) => select([]),
      useInput: (select: (value: { phase: string }) => unknown) => select({ phase: 'idle' }),
      useSession: (select: (value: { blank: boolean; running: boolean; awaitingFirstTurn: boolean }) => unknown) =>
        select({ blank: true, running: false, awaitingFirstTurn: false }),
    }
    let picker!: ReactTestRenderer
    await act(async () => { picker = create(React.createElement(model.component as React.ComponentType<typeof props>, props)) })
    const trigger = picker.root.findByProps({ 'aria-haspopup': 'menu' })
    expect(trigger.props.disabled).toBe(true)
    expect(trigger.props.title).toBe('settings.remoteUnavailable')
    expect(trigger.props['aria-label']).toContain('settings.remoteUnavailable')
    await act(async () => { trigger.props.onClick() })
    expect(directory.select).not.toHaveBeenCalled()
    expect(picker.root.findAllByProps({ role: 'menu' })).toHaveLength(0)
    await act(async () => { picker.unmount() })
  })

  it('refuses a provider change when one declared native binding cannot be read', async () => {
    const { entries, raw, directory } = bench()
    directory.store.getSnapshot.mockReturnValue({ current: { provider: 'cursor-agent', model: 'm' } })
    raw.get = (name: string) => name === 'connection' ? { rpc: {
      call: async (_channel: string, method: string) => method === 'plugin-rpc/antigravity'
        ? { ok: true, value: { provider: null } } : { ok: false },
    } } : undefined
    const model = entries.find(({ spec }) => spec.name === 'conversation.input.model')!
    const face = (model.spec.inject as (id: string) => { select(choice: { provider: string; model: string }): Promise<boolean> })('s')
    await expect(face.select({ provider: 'codex', model: 'm' })).resolves.toBe(false)
    expect(directory.select).not.toHaveBeenCalled()
  })

  it('treats an older ProviderDirectory without nativeBindings as unbound', async () => {
    const { entries, raw } = bench()
    delete (raw.providerDirectory as { nativeBindings?: unknown }).nativeBindings
    const model = entries.find(({ spec }) => spec.name === 'conversation.input.model')!
    const face = (model.spec.inject as (id: string) => {
      providerLockStore: { refresh(): Promise<{ provider: string | null; failed: boolean }> }
    })('s')
    await expect(face.providerLockStore.refresh()).resolves.toEqual({ provider: null, failed: false })
  })

  it('publishes a new stable snapshot when provider declarations change without a reorder', () => {
    const order = ['antigravity', 'llm-codex']
    const store = providerOrderStore({
      getSnapshot: () => ({ status: 'ready', value: { order }, base: {}, user: {}, revision: 1, writable: true, mode: 'host' }),
      subscribe: () => () => undefined,
      set: async () => true,
      unset: async () => true,
      mutate: async () => true,
    })
    const before = store.getSnapshot()
    const changed = vi.fn()
    const dispose = store.subscribe(changed)
    store.invalidate()
    const after = store.getSnapshot()
    expect(changed).toHaveBeenCalledOnce()
    expect(after).toEqual(before)
    expect(after).not.toBe(before)
    expect(store.getSnapshot()).toBe(after)
    dispose()
    store.invalidate()
    expect(changed).toHaveBeenCalledOnce()
  })

  it('uses the official model-seat service gate and an unambiguous winning priority', () => {
    const { entries, injections } = bench()
    expect(injections).toContainEqual(['slots', 'modelDirectories', 'configForms'])
    expect(entries.find(({ spec }) => spec.name === 'conversation.input.model')?.spec.priority).toBe(-10)
  })

  it('restores the configured Main default after a session-only model switch', async () => {
    let mainSnapshot = {
      status: 'ready', value: { provider: 'deepseek', model: 'deep-chat' },
      base: {}, user: {}, revision: 7, writable: true, mode: 'host',
    }
    const mutate = vi.fn(async () => true)
    const mainDefaults = { getSnapshot: () => mainSnapshot, subscribe: () => () => undefined, mutate }
    const providerForm = { getSnapshot: () => ({ status: 'ready', value: { order: [] } }), subscribe: () => () => undefined }
    const directory = {
      store: { subscribe: vi.fn(), getSnapshot: vi.fn() },
      load: vi.fn(async () => undefined),
      select: vi.fn(async () => {
        mainSnapshot = { ...mainSnapshot, value: { provider: 'codex', model: 'gpt-switched' }, revision: 8 }
      }),
    }
    directory.store.getSnapshot.mockReturnValue({ current: mainSnapshot.value })
    const entries: Array<{ spec: Record<string, unknown> }> = []
    const ctx = {
      locale: { register: vi.fn(() => () => undefined) },
      slots: {
        inject: (_name: string, register: () => unknown) => register(),
        register: (spec: Record<string, unknown>) => { entries.push({ spec }); return () => undefined },
      },
      uiConversation: { views: { register: vi.fn(() => vi.fn()) }, events: { register: vi.fn(() => vi.fn()) } },
      modelDirectories: { directoryFor: vi.fn(() => directory) },
      sessions: { subagentAddress: vi.fn(() => undefined) },
      configForms: { get: (id: string) => id === 'agent-default-model' ? mainDefaults : providerForm },
      effect: (register: () => unknown) => register(),
      get: vi.fn(() => undefined),
      inject: (services: string[], register: (scope: unknown) => unknown) => services.includes('providerDirectory') ? undefined : register(ctx),
    }
    installComposerPicker(ctx as never)
    const model = entries.find(({ spec }) => spec.name === 'conversation.input.model')
    const face = (model?.spec.inject as (sessionId: string) => { select(selection: { provider: string; model: string }): Promise<boolean> })('session-1')

    await expect(face.select({ provider: 'codex', model: 'gpt-switched' })).resolves.toBe(true)
    expect(mutate).toHaveBeenCalledWith([
      { op: 'set', path: ['provider'], value: 'deepseek' },
      { op: 'set', path: ['model'], value: 'deep-chat' },
      { op: 'unset', path: ['reasoningEffort'] },
    ], 8)
  })

  it('uses non-strict lookup for the optional interaction service', () => {
    const { entries, directInteractionReads } = bench(true)
    const model = entries.find(({ spec }) => spec.name === 'conversation.input.model')
    const face = (model?.spec.inject as (sessionId: string) => { resolveInteractionOperations(): unknown })('session-1')
    expect(() => face.resolveInteractionOperations()).not.toThrow()
    expect(face.resolveInteractionOperations()).toBeUndefined()
    expect(directInteractionReads()).toBe(0)
  })
})
