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

  it('rejects empty providers and mismatched adapter ownership', () => {
    const registry = new ModelSwitchAdapterRegistry()
    expect(() => registry.register({ provider: '' })).toThrow('non-empty')
    expect(() => registry.register({ provider: 'codex', image: { provider: 'grok', supportsModel: () => true, generate: vi.fn() } })).toThrow('must match')
  })
})
