import { describe, expect, it, vi } from 'vitest'
import type { WebSearchRequest, WebSearchResult } from '@deepseek-ai/dsh-web'
import { ModelSwitchAdapterRegistry } from '../src/adapter-registry.js'
import { MODEL_SWITCH_SEARCH_PROVIDER_ID, ModelSwitchSearchProvider } from '../src/search-provider.js'

function settings(route: Record<string, unknown>) { return () => ({ subagentMode: 'follow-main' as const, ...route }) }

describe('ModelSwitchSearchProvider', () => {
  it('is unavailable until a complete supported adapter route exists', () => {
    const registry = new ModelSwitchAdapterRegistry()
    const provider = new ModelSwitchSearchProvider(settings({ searchProvider: 'codex', searchModel: 'gpt-search' }), registry)
    expect(provider.id).toBe(MODEL_SWITCH_SEARCH_PROVIDER_ID)
    expect(provider.available()).toBe(false)
    registry.register({ provider: 'codex', search: { provider: 'codex', supportsModel: model => model === 'other', search: vi.fn() } })
    expect(provider.available()).toBe(false)
  })

  it('delegates the official request and signal unchanged and preserves its result', async () => {
    const registry = new ModelSwitchAdapterRegistry()
    const result: WebSearchResult = { content: 'answer', sources: [{ url: 'https://example.test', publishedAt: '2026-08-26' }], truncated: false }
    const search = vi.fn(async () => result)
    registry.register({ provider: 'codex', search: { provider: 'codex', supportsModel: model => model === 'gpt-search', search } })
    const provider = new ModelSwitchSearchProvider(settings({ searchProvider: 'codex', searchModel: 'gpt-search' }), registry)
    const request: WebSearchRequest = { query: 'one', maxResults: 3 }
    const controller = new AbortController()
    expect(provider.available()).toBe(true)
    await expect(provider.search(request, controller.signal)).resolves.toBe(result)
    expect(search).toHaveBeenCalledWith('gpt-search', request, controller.signal)
  })

  it('fails loudly when the selected route disappears between availability and execution', async () => {
    const registry = new ModelSwitchAdapterRegistry()
    const dispose = registry.register({ provider: 'codex', search: { provider: 'codex', supportsModel: () => true, search: vi.fn() } })
    const provider = new ModelSwitchSearchProvider(settings({ searchProvider: 'codex', searchModel: 'gpt-search' }), registry)
    expect(provider.available()).toBe(true)
    dispose()
    await expect(provider.search({ query: 'one' })).rejects.toThrow('missing search adapter: codex')
  })
})
