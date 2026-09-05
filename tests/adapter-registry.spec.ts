import { describe, expect, it, vi } from 'vitest'
import { ModelSwitchAdapterRegistry } from '../src/adapter-registry.js'

describe('ModelSwitchAdapterRegistry', () => {
  it('registers one provider generation and disposes only its own generation', () => {
    const registry = new ModelSwitchAdapterRegistry()
    const first = { provider: 'codex', search: { provider: 'codex', supportsModel: () => true, search: vi.fn() } }
    const disposeFirst = registry.register(first)
    expect(registry.get('codex')).toBe(first)
    expect(() => registry.register({ provider: 'codex' })).toThrow('already registered')
    disposeFirst()
    expect(registry.get('codex')).toBeUndefined()
    disposeFirst()
  })

  it('publishes only executable search metadata and notifies each registration generation', () => {
    const registry = new ModelSwitchAdapterRegistry()
    const changed = vi.fn()
    const stop = registry.subscribe(changed)
    const adapter = { provider: 'example', label: 'Example Search', models: [{ id: 'search', name: 'Search' }, { id: 'chat', name: 'Chat' }], supportsModel: (model: string) => model === 'search', search: vi.fn(), token: 'must-not-leak' }
    const dispose = registry.register({ provider: 'example', search: adapter })
    expect(registry.searchCatalog()).toEqual([{ id: 'example', name: 'Example Search', models: [{ id: 'search', name: 'Search' }] }])
    expect(changed).toHaveBeenCalledTimes(1)
    dispose()
    expect(registry.searchCatalog()).toEqual([])
    const next = registry.register({ provider: 'example', search: adapter })
    dispose()
    expect(registry.searchCatalog()).toHaveLength(1)
    expect(changed).toHaveBeenCalledTimes(3)
    stop()
    next()
    expect(changed).toHaveBeenCalledTimes(3)
  })

  it('rejects empty providers and mismatched adapter ownership', () => {
    const registry = new ModelSwitchAdapterRegistry()
    expect(() => registry.register({ provider: '' })).toThrow('non-empty')
    expect(() => registry.register({ provider: 'codex', image: { provider: 'grok', supportsModel: () => true, generate: vi.fn() } })).toThrow('must match')
  })
})
