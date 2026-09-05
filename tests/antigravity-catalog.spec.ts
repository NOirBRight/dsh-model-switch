import { describe, expect, it, vi } from 'vitest'
import {
  ANTIGRAVITY_CATALOG_CHANNEL,
  ANTIGRAVITY_CATALOG_ENDPOINT,
  decodeAntigravityCatalogGroups,
  fetchAntigravityCatalogGroups,
  isAgentRole,
  readProviderRole,
  withAntigravityCatalog,
} from '../src/client/antigravity-catalog.ts'

const agy = { id: 'antigravity', name: 'Antigravity', models: [{ id: 'gemini', name: 'Gemini' }] }
const llm = { id: 'deepseek', name: 'DeepSeek', models: [{ id: 'v3', name: 'V3' }] }

describe('Antigravity enabled catalog', () => {
  it('publishes the released catalog RPC seam', () => {
    expect(ANTIGRAVITY_CATALOG_CHANNEL).toBe('/dsh-acp-antigravity')
    expect(ANTIGRAVITY_CATALOG_ENDPOINT).toBe('catalog')
  })

  it('decodes ready groups and drops malformed entries without throwing', () => {
    expect(decodeAntigravityCatalogGroups({ groups: [agy] })).toEqual([agy])
    expect(decodeAntigravityCatalogGroups({ groups: [agy, { id: 'bad' }, { id: 'empty', name: 'Empty', models: [] }] })).toEqual([agy])
    expect(decodeAntigravityCatalogGroups({ groups: 'nope' })).toEqual([])
    expect(decodeAntigravityCatalogGroups(null)).toEqual([])
  })

  it('fetches the catalog and fails open when the seam is absent', async () => {
    const call = vi.fn(async () => ({ ok: true as const, value: { groups: [agy] } }))
    expect(await fetchAntigravityCatalogGroups({ call })).toEqual([agy])
    expect(call).toHaveBeenCalledWith('/dsh-acp-antigravity', 'catalog', {}, undefined)
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
    expect(readProviderRole(undefined, 'antigravity')).toBeUndefined()
    expect(readProviderRole({}, 'antigravity')).toBeUndefined()
    expect(isAgentRole('agent')).toBe(true)
    expect(isAgentRole('llm')).toBe(false)
    expect(isAgentRole(undefined)).toBe(false)
  })
})
