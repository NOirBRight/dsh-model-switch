import { Context } from '@deepseek-ai/cordis'
import { WebRuntime } from '@deepseek-ai/dsh-web'
import { expect, it, vi } from 'vitest'
import { ModelSwitchAdapterRegistry } from '../src/adapter-registry.js'
import { installModelSwitchSearchProvider } from '../src/search-provider.js'

it('resolves each search through official Web selection, keeps fetch pinned, and never falls back', async () => {
  const ctx = new Context()
  const adapters = new ModelSwitchAdapterRegistry()
  let settings: { searchProvider?: string; searchModel?: string } = {}
  const router = ctx.plugin(scope => installModelSwitchSearchProvider(scope, { adapters, currentSettings: () => settings }))
  await router
  const web = ctx.plugin(WebRuntime, { searchProvider: 'model-switch', fetchProvider: 'custom-fetch' })
  await web
  const fallback = vi.fn(async () => ({ sources: [], truncated: false }))
  const unexpectedFetch = vi.fn()
  ctx.web.registerSearchProvider({ id: 'previous-default', available: () => true, search: fallback })
  ctx.web.registerFetchProvider({ id: 'http', available: () => true, fetch: unexpectedFetch })
  const fetched = { url: 'https://example.test', statusCode: 200, body: { kind: 'text' as const, content: 'custom' }, truncated: false }
  ctx.web.registerFetchProvider({ id: 'custom-fetch', available: () => true, fetch: async () => fetched })
  const request = { query: 'route evidence' }
  const signal = new AbortController().signal
  try {
    await expect(ctx.web.search(request)).rejects.toMatchObject({ code: 'WEB_PROVIDER_CONFIGURED_UNAVAILABLE' })
    settings = { searchProvider: 'late', searchModel: 'one' }
    await expect(ctx.web.search(request)).rejects.toMatchObject({ code: 'WEB_PROVIDER_CONFIGURED_UNAVAILABLE' })
    const calls: string[] = []
    const register = (id: string) => adapters.register({ provider: id, search: { provider: id, models: [{ id: 'one', name: 'One' }, { id: 'two', name: 'Two' }], supportsModel: model => ['one', 'two'].includes(model), search: async (model, actual, actualSignal) => { expect(actual).toBe(request); expect(actualSignal).toBe(signal); calls.push(id + '/' + model); return { sources: [], truncated: false } } } })
    const stop = register('late')
    await ctx.web.search(request, signal)
    settings = { searchProvider: 'late', searchModel: 'two' }
    await ctx.web.search(request, signal)
    const stopOther = register('other')
    settings = { searchProvider: 'other', searchModel: 'one' }
    await ctx.web.search(request, signal)
    expect(calls).toEqual(['late/one', 'late/two', 'other/one'])
    stopOther()
    await expect(ctx.web.search(request)).rejects.toMatchObject({ code: 'WEB_PROVIDER_CONFIGURED_UNAVAILABLE' })
    const again = register('other')
    stopOther()
    await ctx.web.search(request, signal)
    settings = { searchProvider: 'other', searchModel: 'unsupported' }
    await expect(ctx.web.search(request)).rejects.toMatchObject({ code: 'WEB_PROVIDER_CONFIGURED_UNAVAILABLE' })
    await expect(ctx.web.fetch({ url: fetched.url })).resolves.toBe(fetched)
    expect(fallback).not.toHaveBeenCalled()
    expect(unexpectedFetch).not.toHaveBeenCalled()
    stop(); again()
    await router.dispose()
    await expect(ctx.web.search(request)).rejects.toMatchObject({ code: 'WEB_PROVIDER_CONFIGURED_MISSING' })
  } finally { await ctx.fiber.dispose() }
})
