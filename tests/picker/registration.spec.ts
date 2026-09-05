import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => {
  const Stub = () => null
  return {
    Button: Stub, Input: Stub, Toast: Stub, MarkdownText: Stub,
    IconCheckOutline16: Stub, IconChevronDownOutline14: Stub, IconChevronLeftOutline14: Stub,
    IconChevronRightOutline14: Stub, IconCloseOutline16: Stub, IconSearchOutline16: Stub, IconWarningOutline16: Stub,
  }
})

import { installComposerPicker } from '../../src/client/picker/install.tsx'

function bench(strictOptionalLookup = false) {
  const entries: Array<{ spec: Record<string, unknown>, component: unknown }> = []
  const injections: string[][] = []
  const directory = {
    store: { subscribe: vi.fn(), getSnapshot: vi.fn() },
    load: vi.fn(async () => undefined),
    select: vi.fn(async () => undefined),
  }
  const raw: Record<string, unknown> = {
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
    settingsScope: { bind: vi.fn(() => ({ getSnapshot: () => ({ status: 'loading' }) })) },
    remote: { settings: { mutate: vi.fn(async () => ({ ok: true, value: { revision: 9 } })) } },
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
    return register(ctx)
  }
  installComposerPicker(ctx as never)
  return { entries, injections, directInteractionReads: () => directInteractionReads }
}

describe('composer picker seat ownership', () => {
  it('uses the official model-seat service gate and an unambiguous winning priority', () => {
    const { entries, injections } = bench()
    expect(injections).toContainEqual(['slots', 'modelDirectories', 'settingsScope', 'remote.settings'])
    expect(entries.find(({ spec }) => spec.name === 'conversation.input.model')?.spec.priority).toBe(-10)
  })

  it('restores the configured Main default after a session-only model switch', async () => {
    let mainSnapshot = {
      status: 'ready', value: { provider: 'deepseek', model: 'deep-chat' },
      base: {}, user: {}, revision: 7, writable: true, mode: 'host',
    }
    const mutate = vi.fn(async () => ({ ok: true as const, value: { revision: 9 } }))
    const directory = {
      store: { subscribe: vi.fn(), getSnapshot: vi.fn() },
      load: vi.fn(async () => undefined),
      select: vi.fn(async () => {
        mainSnapshot = { ...mainSnapshot, value: { provider: 'codex', model: 'gpt-switched' }, revision: 8 }
      }),
    }
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
      settingsScope: { bind: vi.fn(() => ({ getSnapshot: () => mainSnapshot, subscribe: vi.fn(() => vi.fn()) })) },
      remote: { settings: { mutate } },
      effect: (register: () => unknown) => register(),
      get: vi.fn(() => undefined),
      inject: (_services: string[], register: (scope: unknown) => unknown) => register(ctx),
    }
    installComposerPicker(ctx as never)
    const model = entries.find(({ spec }) => spec.name === 'conversation.input.model')
    const face = (model?.spec.inject as (sessionId: string) => { select(selection: { provider: string; model: string }): Promise<boolean> })('session-1')

    await expect(face.select({ provider: 'codex', model: 'gpt-switched' })).resolves.toBe(true)
    expect(mutate).toHaveBeenCalledWith('agent-default-model', [
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
