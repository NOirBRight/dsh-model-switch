import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { SettingsProvider, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import { WebRuntime } from '@deepseek-ai/dsh-web'
import { ModelSwitchAdapterRegistry } from '../src/adapter-registry.js'
import { ModelSwitchSearchProvider } from '../src/search-provider.js'
import { DeepSeekSearchAdapter, installDeepSeekSearchAdapter } from '../src/deepseek-search-adapter.js'

class MemorySettings extends SettingsProvider {
  document: Record<string, unknown> = {}
  get writable(): boolean { return true }
  protected load(): Promise<Record<string, unknown>> { return Promise.resolve(structuredClone(this.document)) }
  protected persist(ns: SettingsNamespace, section: Record<string, unknown>): Promise<void> {
    this.document[String(ns)] = structuredClone(section)
    return Promise.resolve()
  }
}

class SearchAdapterOwner extends Service {
  readonly adapters = new ModelSwitchAdapterRegistry()
  constructor(ctx: Context) { super(ctx, 'modelSwitch') }
}

const KEY_ENV = 'DEEPSEEK_API_KEY'
const BASE_ENV = 'DEEPSEEK_SEARCH_BASE_URL'
let savedKey: string | undefined
let savedBase: string | undefined

beforeEach(() => {
  savedKey = process.env[KEY_ENV]
  savedBase = process.env[BASE_ENV]
  delete process.env[KEY_ENV]
  delete process.env[BASE_ENV]
})

afterEach(() => {
  if (savedKey === undefined) delete process.env[KEY_ENV]
  else process.env[KEY_ENV] = savedKey
  if (savedBase === undefined) delete process.env[BASE_ENV]
  else process.env[BASE_ENV] = savedBase
  vi.unstubAllGlobals()
})

const ANTHROPIC_BODY = {
  content: [
    {
      type: 'web_search_tool_result',
      content: [{ type: 'web_search_result', url: 'https://example.test/deepseek', title: 'DeepSeek Docs', page_age: '2026-09-01' }],
    },
    {
      type: 'text',
      text: 'DeepSeek summary.',
      citations: [{ url: 'https://example.test/deepseek', cited_text: 'Search excerpt.' }],
    },
  ],
}

function stubAnthropic() {
  const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => structuredClone(ANTHROPIC_BODY) }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function sentRequest(fetchMock: ReturnType<typeof stubAnthropic>) {
  const call = fetchMock.mock.calls[0] as unknown as [string, { method: string, headers: Record<string, string>, body: string }]
  return { url: call[0], init: call[1], body: JSON.parse(call[1].body) as { model: string, max_tokens: number, tools: Array<{ max_uses: number }> } }
}

async function bootWeb(ctx: Context, adapters: ModelSwitchAdapterRegistry, route: { provider: string, model: string }) {
  const webFiber = ctx.plugin(WebRuntime, { searchProvider: 'model-switch' })
  await webFiber
  const thin = new ModelSwitchSearchProvider(() => ({ searchProvider: route.provider, searchModel: route.model }), adapters)
  ctx.web.registerSearchProvider(thin)
  return { ctx, webFiber }
}

describe('DeepSeekSearchAdapter', () => {
  it('routes WebRuntime.search through the official provider with section endpoint and per-call model', async () => {
    const ctx = new Context()
    const settingsFiber = ctx.plugin(MemorySettings)
    await settingsFiber
    ctx.settings.register('web-search-deepseek', z.object({ baseURL: z.string(), maxUses: z.number() }), {
      base: { baseURL: 'https://search.example.test/anthropic/v1', maxUses: 7 },
    })
    process.env[KEY_ENV] = 'test-key-1'
    const adapters = new ModelSwitchAdapterRegistry()
    adapters.register({ provider: 'deepseek-official', search: new DeepSeekSearchAdapter(ctx) })
    const web = await bootWeb(ctx, adapters, { provider: 'deepseek-official', model: 'deepseek-v4-pro' })
    const fetchMock = stubAnthropic()
    const result = await web.ctx.web.search({ query: 'deepseek web search', maxResults: 5 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const sent = sentRequest(fetchMock)
    expect(sent.url).toBe('https://search.example.test/anthropic/v1/messages')
    expect(sent.init.method).toBe('POST')
    expect(sent.init.headers['authorization']).toBe('Bearer test-key-1')
    expect(sent.init.headers['anthropic-version']).toBe('2023-06-01')
    expect(sent.body.model).toBe('deepseek-v4-pro')
    expect(sent.body.max_tokens).toBe(4096)
    expect(sent.body.tools).toHaveLength(1)
    expect(sent.body.tools[0]?.max_uses).toBe(7)
    expect(JSON.stringify(sent.body)).not.toContain('test-key-1')
    expect(result).toEqual({
      sources: [{ url: 'https://example.test/deepseek', title: 'DeepSeek Docs', snippet: 'Search excerpt.', publishedAt: '2026-09-01' }],
      truncated: false,
    })
    await web.webFiber.dispose()
    await settingsFiber.dispose()
  })

  it('falls back to launch environment and official defaults without a settings section', async () => {
    process.env[KEY_ENV] = 'test-key-2'
    process.env[BASE_ENV] = 'https://env.example.test/anthropic/v1'
    const ctx = new Context()
    const adapters = new ModelSwitchAdapterRegistry()
    adapters.register({ provider: 'deepseek-official', search: new DeepSeekSearchAdapter(ctx) })
    const web = await bootWeb(ctx, adapters, { provider: 'deepseek-official', model: 'deepseek-v4-flash' })
    const fetchMock = stubAnthropic()
    const result = await web.ctx.web.search({ query: 'fallback' })
    expect(sentRequest(fetchMock).url).toBe('https://env.example.test/anthropic/v1/messages')
    expect(sentRequest(fetchMock).body.tools[0]?.max_uses).toBe(5)
    expect(result.truncated).toBe(false)
    expect(result.sources).toHaveLength(1)
    await web.webFiber.dispose()
  })

  it('rejects unknown models before touching the network', async () => {
    const adapter = new DeepSeekSearchAdapter(new Context())
    expect(adapter.provider).toBe('deepseek-official')
    expect(adapter.models.map((model) => model.id)).toEqual(['deepseek-v4-flash', 'deepseek-v4-pro'])
    expect(adapter.supportsModel('deepseek-v4-flash')).toBe(true)
    expect(adapter.supportsModel('deepseek-v4-pro')).toBe(true)
    expect(adapter.supportsModel('deepseek-chat')).toBe(false)
    const fetchMock = stubAnthropic()
    await expect(adapter.search('deepseek-chat', { query: 'gated' })).rejects.toThrow('search model is not supported by adapter: deepseek-official/deepseek-chat')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('surfaces a missing credential without dispatching', async () => {
    const ctx = new Context()
    const adapters = new ModelSwitchAdapterRegistry()
    adapters.register({ provider: 'deepseek-official', search: new DeepSeekSearchAdapter(ctx) })
    const web = await bootWeb(ctx, adapters, { provider: 'deepseek-official', model: 'deepseek-v4-flash' })
    const fetchMock = stubAnthropic()
    await expect(web.ctx.web.search({ query: 'no key' })).rejects.toThrow('DEEPSEEK_API_KEY')
    expect(fetchMock).not.toHaveBeenCalled()
    await web.webFiber.dispose()
  })

  it('rejects an invalid official section without dispatching', async () => {
    const ctx = new Context()
    const settingsFiber = ctx.plugin(MemorySettings)
    await settingsFiber
    ctx.settings.register('web-search-deepseek', z.object({ maxUses: z.number() }), { base: { maxUses: 0 } })
    process.env[KEY_ENV] = 'test-key-9'
    const adapters = new ModelSwitchAdapterRegistry()
    adapters.register({ provider: 'deepseek-official', search: new DeepSeekSearchAdapter(ctx) })
    const web = await bootWeb(ctx, adapters, { provider: 'deepseek-official', model: 'deepseek-v4-flash' })
    const fetchMock = stubAnthropic()
    await expect(web.ctx.web.search({ query: 'bad section' })).rejects.toThrow('invalid web-search-deepseek settings section')
    expect(fetchMock).not.toHaveBeenCalled()
    await web.webFiber.dispose()
    await settingsFiber.dispose()
  })

  it('installs into the modelSwitch registry and unregisters on disposal', async () => {
    const ctx = new Context()
    const ownerFiber = ctx.plugin(SearchAdapterOwner)
    await ownerFiber
    installDeepSeekSearchAdapter(ctx)
    await new Promise((resolve) => setTimeout(resolve, 0))
    const adapters = ctx.modelSwitch.adapters
    const search = adapters.get('deepseek-official')?.search
    expect(search).toBeInstanceOf(DeepSeekSearchAdapter)
    expect(search?.supportsModel('deepseek-v4-flash')).toBe(true)
    expect(adapters.searchCatalog()).toEqual([{
      id: 'deepseek-official',
      name: 'DeepSeek',
      models: [
        { id: 'deepseek-v4-flash', name: 'DeepSeek-V4-Flash' },
        { id: 'deepseek-v4-pro', name: 'DeepSeek-V4-Pro' },
      ],
    }])
    await ownerFiber.dispose()
    expect(adapters.get('deepseek-official')).toBeUndefined()
  })
})
