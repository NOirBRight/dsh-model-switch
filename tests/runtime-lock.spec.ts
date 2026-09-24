import { describe, expect, it, vi } from 'vitest'
import {
  createProviderLockStore, decodeBindingProvider, effectiveProviderLock,
  fetchSessionBinding, agentProviderLocked, isProviderAllowed,
  providerSelectable, runtimeChoiceAllowed,
} from '../src/client/runtime-lock.ts'

const sources = [
  { provider: 'antigravity', channel: 'plugin-rpc/antigravity', endpoint: 'activity/binding' },
  { provider: 'cursor-agent', channel: 'plugin-rpc/cursor', endpoint: 'activity/binding' },
]

describe('declared native binding queries', () => {
  it('accepts only an unbound reply or the queried provider identity', () => {
    expect(decodeBindingProvider({ provider: 'new-native' }, 'new-native')).toBe('new-native')
    expect(decodeBindingProvider({ provider: null }, 'new-native')).toBeNull()
    for (const value of [{ provider: 'codex' }, {}, null, [], 'new-native']) {
      expect(decodeBindingProvider(value, 'new-native')).toBeUndefined()
    }
  })

  it('queries only registered bindings and handles no installed Agent', async () => {
    expect(await fetchSessionBinding(undefined, 's', [])).toEqual({ provider: null, failed: false })
    expect(await fetchSessionBinding(undefined, 's', sources)).toEqual({ provider: null, failed: true })
    const rpc = { call: vi.fn(async () => ({ ok: true, value: { provider: 'cursor-agent' } })) }
    expect(await fetchSessionBinding(rpc, 's', [sources[1]!])).toEqual({ provider: 'cursor-agent', failed: false })
    expect(rpc.call).toHaveBeenCalledExactlyOnceWith('/api', 'plugin-rpc/cursor', { endpoint: 'activity/binding', payload: { sessionId: 's' } }, undefined)
  })

  it('does not turn one unbound reply plus a failed query into a successful unlock', async () => {
    const rpc = { call: vi.fn(async (_channel: string, method: string) => method === sources[0]!.channel
      ? { ok: true, value: { provider: null } } : { ok: false }) }
    expect(await fetchSessionBinding(rpc, 's', sources)).toEqual({ provider: null, failed: true })
    const throwing = { call: vi.fn(async () => { throw new Error('offline') }) }
    expect(await fetchSessionBinding(throwing, 's', sources)).toEqual({ provider: null, failed: true })
  })

  it('retains a proven binding on partial failure and rejects conflicting bindings', async () => {
    const rpc = { call: vi.fn(async (_channel: string, method: string) => method === sources[0]!.channel
      ? { ok: true, value: { provider: 'antigravity' } } : { ok: false }) }
    expect(await fetchSessionBinding(rpc, 's', sources)).toEqual({ provider: 'antigravity', failed: true })
    const conflict = { call: vi.fn(async (_channel: string, method: string) => ({ ok: true, value: {
      provider: sources.find(source => source.channel === method)!.provider,
    } })) }
    expect(await fetchSessionBinding(conflict, 's', sources)).toEqual({ provider: null, failed: true })
  })

  it('unlocks only after all declared providers report unbound', async () => {
    const rpc = { call: vi.fn(async () => ({ ok: true, value: { provider: null } })) }
    expect(await fetchSessionBinding(rpc, 's', sources)).toEqual({ provider: null, failed: false })
  })
})

describe('provider-neutral selection policy', () => {
  const unbound = { provider: null, failed: false } as const
  for (const current of ['antigravity', 'cursor-agent', 'another-native']) {
    it('reserves ' + current + ' from its declared role, not its name', () => {
      expect(effectiveProviderLock(unbound, current, true, true)).toBe(current)
      expect(isProviderAllowed(unbound, 'codex', current, { active: true, currentAgent: true })).toBe(false)
      expect(isProviderAllowed(unbound, current, current, { active: true, currentAgent: true, agent: true })).toBe(true)
      expect(effectiveProviderLock(unbound, current, false, true)).toBeNull()
    })
  }

  it('keeps LLM choices available while preventing conversion of existing DSH history', () => {
    expect(effectiveProviderLock(unbound, 'codex', true, false)).toBeNull()
    expect(isProviderAllowed(unbound, 'grok', 'codex', { active: true, currentAgent: false })).toBe(true)
    expect(isProviderAllowed(unbound, 'new-native', 'codex', { blank: false, agent: true })).toBe(false)
    expect(isProviderAllowed(unbound, 'new-native', 'codex', { blank: true, agent: true })).toBe(true)
    expect(agentProviderLocked(false, null)).toBe(true)
    expect(agentProviderLocked(false, 'new-native')).toBe(false)
  })

  it('makes a durable binding authoritative over a transient selection', () => {
    const state = { provider: 'cursor-agent', failed: false }
    expect(effectiveProviderLock(state, 'antigravity', true, true)).toBe('cursor-agent')
    expect(providerSelectable(state.provider, 'antigravity')).toBe(false)
    expect(runtimeChoiceAllowed(state.provider, false, 'cursor-agent', 'cursor-agent', true)).toBe(true)
    expect(runtimeChoiceAllowed(null, true, 'antigravity', 'cursor-agent', true)).toBe(false)
  })

  it('allows no provider change after a failed read, including without a native current selection', () => {
    const failed = { provider: null, failed: true } as const
    for (const current of ['cursor-agent', 'codex']) {
      expect(effectiveProviderLock(failed, current)).toBe(current)
      expect(isProviderAllowed(failed, 'grok', current)).toBe(false)
      expect(isProviderAllowed(failed, current, current)).toBe(true)
    }
    expect(isProviderAllowed(failed, 'codex', undefined)).toBe(false)
    expect(effectiveProviderLock({ provider: 'cursor-agent', failed: true }, 'codex')).toBe('cursor-agent')
  })
})

describe('Antigravity provider lock store', () => {
  it('starts unlocked and publishes successful reads', async () => {
    const store = createProviderLockStore(async () => ({ provider: 'antigravity', failed: false }))
    expect(store.getSnapshot()).toEqual({ provider: null, failed: false })
    const seen: unknown[] = []
    const stop = store.subscribe(() => {
      seen.push(store.getSnapshot())
    })
    await expect(store.refresh()).resolves.toEqual({ provider: 'antigravity', failed: false })
    expect(seen).toEqual([{ provider: 'antigravity', failed: false }])
    stop()
  })

  it('keeps the sticky provider and flags failed reads without rejecting', async () => {
    let fail = false
    const store = createProviderLockStore(async (previous) => {
      if (fail) return { provider: previous.provider, failed: true }
      return { provider: 'antigravity', failed: false }
    })
    await store.refresh()
    fail = true
    await expect(store.refresh()).resolves.toEqual({ provider: 'antigravity', failed: true })
  })

  it('drops stale concurrent reads in call order', async () => {
    let release!: (value: { provider: 'antigravity' | null; failed: boolean }) => void
    const gate = new Promise<{ provider: 'antigravity' | null; failed: boolean }>((resolve) => {
      release = resolve
    })
    let calls = 0
    const store = createProviderLockStore(() => {
      calls += 1
      return calls === 1 ? gate : Promise.resolve({ provider: null as const, failed: false })
    })
    const first = store.refresh()
    const second = await store.refresh()
    expect(second).toEqual({ provider: null, failed: false })
    release({ provider: 'antigravity', failed: false })
    await expect(first).resolves.toEqual({ provider: null, failed: false })
    expect(store.getSnapshot()).toEqual({ provider: null, failed: false })
    expect(calls).toBe(2)
  })
})
