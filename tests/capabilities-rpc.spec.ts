import { expect, it, vi } from 'vitest'
import { ModelSwitchAdapterRegistry } from '../src/adapter-registry.js'
import { capabilitiesRpc } from '../src/capabilities-rpc.js'
import { RUNTIME_CAPABILITIES } from '../src/runtime-capabilities.js'

it('delivers registration changes through the Host RPC and closes subscriptions on abort', async () => {
  const registry = new ModelSwitchAdapterRegistry()
  const lifetime = new AbortController()
  const request = new AbortController()
  const rpc = capabilitiesRpc(registry, () => ({ ...RUNTIME_CAPABILITIES, searchProviderAdapters: { available: true, catalog: registry.searchCatalog() } }), lifetime.signal)
  expect(await rpc('capabilities', {}, request.signal)).toMatchObject({ ok: true, value: { revision: 0, capabilities: { searchProviderAdapters: { catalog: [] } } } })
  const pending = rpc('capabilities', { revision: 0 }, request.signal)
  const dispose = registry.register({ provider: 'late', search: { provider: 'late', models: [{ id: 'search', name: 'Search' }], supportsModel: () => true, search: async () => ({ sources: [], truncated: false }) } })
  expect(await pending).toMatchObject({ ok: true, value: { revision: 1, capabilities: { searchProviderAdapters: { catalog: [{ id: 'late' }] } } } })
  const removed = rpc('capabilities', { revision: 1 }, request.signal)
  dispose()
  expect(await removed).toMatchObject({ ok: true, value: { revision: 2, capabilities: { searchProviderAdapters: { catalog: [] } } } })
  const cancelled = rpc('capabilities', { revision: 2 }, request.signal)
  request.abort()
  expect(await cancelled).toMatchObject({ ok: false, error: { code: 'cancelled' } })
  const stopped = rpc('capabilities', { revision: 2 }, new AbortController().signal)
  lifetime.abort()
  expect(await stopped).toMatchObject({ ok: false, error: { code: 'cancelled' } })
  expect(await rpc('capabilities', { revision: -1 }, request.signal)).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
  expect(await rpc('search', {}, request.signal)).toMatchObject({ ok: false, error: { code: 'unknown-endpoint' } })
})

it('advances the wire revision when a provider changes its model declaration in place', async () => {
  vi.useFakeTimers()
  const registry = new ModelSwitchAdapterRegistry()
  const lifetime = new AbortController()
  let model = 'before'
  registry.register({ provider: 'dynamic', search: { provider: 'dynamic', get models() { return [{ id: model, name: model }] }, supportsModel: () => true, search: async () => ({ sources: [], truncated: false }) } })
  const rpc = capabilitiesRpc(registry, () => ({ ...RUNTIME_CAPABILITIES, searchProviderAdapters: { available: true, catalog: registry.searchCatalog() } }), lifetime.signal)
  try {
    const first = await rpc('capabilities', {}, lifetime.signal)
    if (!first.ok) throw new Error(first.error.code)
    const revision = (first.value as { revision: number }).revision
    const next = rpc('capabilities', { revision }, lifetime.signal)
    model = 'after'
    await vi.advanceTimersByTimeAsync(20_000)
    const result = await next
    expect(result).toMatchObject({ ok: true, value: { revision: revision + 1, capabilities: { searchProviderAdapters: { catalog: [{ models: [{ id: 'after' }] }] } } } })
  } finally { lifetime.abort(); vi.useRealTimers() }
})
