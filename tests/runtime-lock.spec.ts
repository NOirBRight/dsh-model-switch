import { describe, expect, it, vi } from 'vitest'
import {
  createProviderLockStore,
  decodeBindingProvider,
  effectiveProviderLock,
  fetchSessionBinding,
  agentProviderLocked,
  isProviderAllowed,
  providerSelectable,
  runtimeChoiceAllowed,
} from '../src/client/runtime-lock.ts'

describe('Antigravity binding reply', () => {
  it('decodes bound, unbound, and malformed replies', () => {
    expect(decodeBindingProvider({ provider: 'antigravity' })).toBe('antigravity')
    expect(decodeBindingProvider({ provider: null })).toBeNull()
    expect(decodeBindingProvider({ provider: 'codex' })).toBeUndefined()
    expect(decodeBindingProvider({})).toBeUndefined()
    expect(decodeBindingProvider(null)).toBeUndefined()
    expect(decodeBindingProvider('antigravity')).toBeUndefined()
  })

  it('reads undefined without a plugin rpc and on any failure', async () => {
    await expect(fetchSessionBinding(undefined, 'session-1')).resolves.toBeUndefined()
    const failing = { call: vi.fn(async () => { throw new Error('down') }) }
    await expect(fetchSessionBinding(failing, 'session-1')).resolves.toBeUndefined()
    const rejected = { call: vi.fn(async () => ({ ok: false as const, error: { code: 'x', message: 'y', details: {} } })) }
    await expect(fetchSessionBinding(rejected, 'session-1')).resolves.toBeUndefined()
    const malformed = { call: vi.fn(async () => ({ ok: true as const, value: { provider: 'codex' } })) }
    await expect(fetchSessionBinding(malformed, 'session-1')).resolves.toBeUndefined()
  })

  it('reads the bound provider for one session', async () => {
    const rpc = { call: vi.fn(async () => ({ ok: true as const, value: { provider: 'antigravity' } })) }
    await expect(fetchSessionBinding(rpc, 'session-9')).resolves.toBe('antigravity')
    expect(rpc.call).toHaveBeenCalledWith('/dsh-acp-antigravity', 'activity/binding', { sessionId: 'session-9' }, undefined)
  })
})

describe('Antigravity provider lock policy', () => {
  it('reserves the running native runtime before its first token or binding arrives', () => {
    const unbound = { provider: null, failed: false } as const
    expect(effectiveProviderLock(unbound, 'antigravity', true)).toBe('antigravity')
    expect(isProviderAllowed(unbound, 'codex', 'antigravity', { active: true, blank: true })).toBe(false)
    expect(isProviderAllowed(unbound, 'antigravity', 'antigravity', { active: true, blank: true, agent: true })).toBe(true)
    expect(effectiveProviderLock(unbound, 'antigravity', false)).toBeNull()
  })

  it('keeps LLM routing within DSH while its first response is pending', () => {
    const unbound = { provider: null, failed: false } as const
    expect(agentProviderLocked(true, null, true)).toBe(true)
    expect(isProviderAllowed(unbound, 'antigravity', 'codex', { active: true, blank: true, agent: true })).toBe(false)
    expect(isProviderAllowed(unbound, 'grok', 'codex', { active: true, blank: true, agent: false })).toBe(true)
    expect(isProviderAllowed(unbound, 'antigravity', 'codex', { active: false, blank: true, agent: true })).toBe(true)
  })

  it('blocks other providers while preserving Antigravity controls', () => {
    expect(providerSelectable(null, 'codex')).toBe(true)
    expect(providerSelectable('antigravity', 'codex')).toBe(false)
    expect(providerSelectable('antigravity', 'antigravity')).toBe(true)
  })

  it('fails closed for native-bound sessions and stays open for pure LLM', () => {
    expect(isProviderAllowed({ provider: 'antigravity', failed: false }, 'codex', 'antigravity')).toBe(false)
    expect(isProviderAllowed({ provider: 'antigravity', failed: false }, 'antigravity', 'antigravity')).toBe(true)
    expect(isProviderAllowed({ provider: null, failed: false }, 'codex', 'codex')).toBe(true)
    expect(isProviderAllowed({ provider: 'antigravity', failed: true }, 'codex', 'antigravity')).toBe(false)
    expect(isProviderAllowed({ provider: null, failed: true }, 'codex', 'antigravity')).toBe(false)
    expect(isProviderAllowed({ provider: null, failed: true }, 'antigravity', 'antigravity')).toBe(true)
    expect(isProviderAllowed({ provider: null, failed: true }, 'codex', 'codex')).toBe(true)
    expect(isProviderAllowed({ provider: null, failed: true }, 'codex', undefined)).toBe(true)
  })

  it('blocks Agent-role switches on existing DSH history and keeps blank sessions open', () => {
    const unbound = { provider: null, failed: false } as const
    expect(agentProviderLocked(true, null)).toBe(false)
    expect(agentProviderLocked(false, null)).toBe(true)
    expect(agentProviderLocked(false, 'antigravity')).toBe(false)
    expect(isProviderAllowed(unbound, 'antigravity', 'deepseek', { blank: false, agent: true })).toBe(false)
    expect(isProviderAllowed(unbound, 'antigravity', 'antigravity', { blank: false, agent: true })).toBe(true)
    expect(isProviderAllowed(unbound, 'deepseek', 'deepseek', { blank: false, agent: false })).toBe(true)
    expect(isProviderAllowed(unbound, 'antigravity', 'deepseek', { blank: true, agent: true })).toBe(true)
    expect(isProviderAllowed(unbound, 'antigravity', 'deepseek', { agent: true })).toBe(true)
  })

  it('keeps the current Agent selectable in the picker after history', () => {
    expect(runtimeChoiceAllowed(null, true, 'cursor-agent', 'cursor-agent', true)).toBe(true)
    expect(runtimeChoiceAllowed(null, true, 'antigravity', 'cursor-agent', true)).toBe(false)
    expect(runtimeChoiceAllowed(null, true, 'codex', 'codex', false)).toBe(true)
    expect(runtimeChoiceAllowed('antigravity', false, 'antigravity', 'antigravity', true)).toBe(true)
    expect(runtimeChoiceAllowed('antigravity', false, 'codex', 'antigravity', false)).toBe(false)
  })

  it('maps failed reads to the same effective single-provider lock', () => {
    expect(effectiveProviderLock({ provider: 'antigravity', failed: false }, 'antigravity')).toBe('antigravity')
    expect(effectiveProviderLock({ provider: null, failed: false }, 'codex')).toBeNull()
    expect(effectiveProviderLock({ provider: null, failed: true }, 'antigravity')).toBe('antigravity')
    expect(effectiveProviderLock({ provider: null, failed: true }, 'codex')).toBeNull()
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
