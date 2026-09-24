import { describe, expect, it, vi } from 'vitest'
import {
  ANTIGRAVITY_CATALOG_METHOD,
  ANTIGRAVITY_CATALOG_ENDPOINT,
  decodeAntigravityCatalogGroups,
  fetchAntigravityCatalogGroups,
  isAgentRole,
  matchCatalogModel,
  readProviderRole,
  withAntigravityCatalog,
} from '../src/client/antigravity-catalog.ts'

const agy = { id: 'antigravity', name: 'Antigravity', models: [{ id: 'gemini', name: 'Gemini' }] }
const llm = { id: 'deepseek', name: 'DeepSeek', models: [{ id: 'v3', name: 'V3' }] }

describe('Antigravity enabled catalog', () => {
  it('publishes the released catalog RPC seam', () => {
    expect(ANTIGRAVITY_CATALOG_METHOD).toBe('plugin-rpc/antigravity')
    expect(ANTIGRAVITY_CATALOG_ENDPOINT).toBe('catalog')
  })

  it('decodes ready groups and drops malformed entries without throwing', () => {
    expect(decodeAntigravityCatalogGroups({ groups: [agy] })).toEqual([agy])
    expect(decodeAntigravityCatalogGroups({ groups: [agy, { id: 'bad' }, { id: 'empty', name: 'Empty', models: [] }] })).toEqual([agy])
    expect(decodeAntigravityCatalogGroups({ groups: 'nope' })).toEqual([])
    expect(decodeAntigravityCatalogGroups(null)).toEqual([])
  })

  it('keeps published reasoning and collapses native high/medium/low rows', () => {
    const collapsed = decodeAntigravityCatalogGroups({ groups: [{ id: 'antigravity', name: 'Antigravity', models: [
      { id: 'gemini-3.8-flash-high', name: 'Gemini 3.8 Flash (High)' },
      { id: 'gemini-3.8-flash-medium', name: 'Gemini 3.8 Flash (Medium)' },
      { id: 'gemini-3.8-flash-low', name: 'Gemini 3.8 Flash (Low)' },
    ] }] })
    expect(collapsed[0]?.models).toEqual([{ id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', reasoning: { efforts: [{ id: 'high', name: 'High' }, { id: 'medium', name: 'Medium' }, { id: 'low', name: 'Low' }], defaultEffort: 'high' } }])
    expect(matchCatalogModel(collapsed[0]!.models, 'gemini-3.8-flash-high')).toEqual({ model: collapsed[0]!.models[0], effort: 'high' })
    const published = decodeAntigravityCatalogGroups({ groups: [{ id: 'antigravity', name: 'Antigravity', models: [{ id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', reasoning: { efforts: [{ id: 'high', name: 'High' }], defaultEffort: 'high' } }] }] })
    expect(published[0]?.models[0]?.reasoning?.defaultEffort).toBe('high')
  })

  it('does not normalize an unsupported stored native effort into a routable combination', () => {
    const models = [{ id: 'x', name: 'X', reasoning: { efforts: [{ id: 'low', name: 'Low' }], defaultEffort: 'low' } }]
    expect(matchCatalogModel(models, 'x-high')).toBeUndefined()
    expect(matchCatalogModel(models, 'x-low')).toEqual({ model: models[0], effort: 'low' })
    expect(matchCatalogModel([{ id: 'x', name: 'X' }], 'x-high')).toBeUndefined()
  })

  it('fetches the catalog and fails open when the seam is absent', async () => {
    const call = vi.fn(async () => ({ ok: true as const, value: { groups: [agy] } }))
    expect(await fetchAntigravityCatalogGroups({ call })).toEqual([agy])
    expect(call).toHaveBeenCalledWith('/api', 'plugin-rpc/antigravity', { endpoint: 'catalog', payload: {} }, undefined)
    expect(await fetchAntigravityCatalogGroups(undefined)).toEqual([])
    expect(await fetchAntigravityCatalogGroups({ call: async () => { throw new Error('down') } })).toEqual([])
    expect(await fetchAntigravityCatalogGroups({ call: async () => ({ ok: false as const }) })).toEqual([])
  })

  it('overlays enabled groups without duplicating host ids', () => {
    expect(withAntigravityCatalog([llm], [])).toEqual([llm])
    expect(withAntigravityCatalog([llm], [agy])).toEqual([llm, agy])
    expect(withAntigravityCatalog([llm, agy], [agy])).toEqual([llm, agy])
  })

  it('reads the owner role and only treats agent as Agent', () => {
    expect(readProviderRole({ roleOf: (key: string) => key === 'antigravity' ? 'agent' : 'llm' }, 'antigravity')).toBe('agent')
    expect(readProviderRole({ roleOf: (key: string) => key === 'native-card' ? 'agent' : 'llm', catalogRoutes: () => ({ 'new-native': 'native-card' }) }, 'new-native')).toBe('agent')
    expect(readProviderRole({ roleOf: () => 'agent', catalogRoutes: 'not-a-function' }, 'antigravity')).toBe('agent')
    expect(readProviderRole(undefined, 'antigravity')).toBeUndefined()
    expect(readProviderRole({}, 'antigravity')).toBeUndefined()
    expect(isAgentRole('agent')).toBe(true)
    expect(isAgentRole('llm')).toBe(false)
    expect(isAgentRole(undefined)).toBe(false)
  })
})
