import { describe, expect, it } from 'vitest'
import {
  contextLabelForMember,
  contextTiers,
  familyHasContextChoices,
  familyHasFast,
  filterFamilies,
  findFamily,
  groupFamilies,
  parsePickerId,
  pickVariant,
  selectionOf,
  thinkingSiblings,
  type CatalogGroupView,
} from '../../src/picker/family.ts'

const reasoning = {
  defaultEffort: 'high',
  efforts: [{ id: 'low', name: 'Low' }, { id: 'high', name: 'High' }],
}

const groups: CatalogGroupView[] = [
  {
    id: 'codex',
    name: 'Codex',
    models: [
      { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', reasoning },
      { id: 'gpt-5.6-sol-fast', name: 'GPT-5.6 Sol Fast', reasoning },
      { id: 'gpt-5.6-sol-1m', name: 'GPT-5.6 Sol 1M', reasoning },
      { id: 'gpt-5.6-sol-1m-fast', name: 'GPT-5.6 Sol 1M Fast', reasoning },
      { id: 'gpt-5.6-sol-272k', name: 'GPT-5.6 Sol 272K', reasoning },
    ],
  },
  {
    id: 'ollama-cloud',
    name: 'Ollama Cloud',
    models: [
      { id: 'kimi-k3-max', name: 'Kimi K3 Max', reasoning },
      { id: 'qwen3', name: 'Qwen3' },
      { id: 'qwen3-thinking', name: 'Qwen3 Thinking', reasoning },
    ],
  },
]

describe('parsePickerId', () => {
  it('peels Fast then a numeric context suffix', () => {
    expect(parsePickerId('gpt-5.6-sol-272k-fast')).toEqual({
      base: 'gpt-5.6-sol',
      fast: true,
      contextTier: '272k',
      contextTokens: 272_000,
    })
    expect(parsePickerId('gpt-5.6-sol-1m')).toEqual({
      base: 'gpt-5.6-sol',
      fast: false,
      contextTier: '1m',
      contextTokens: 1_000_000,
    })
  })

  it('peels Cursor Fast-before-context ids into the same family', () => {
    expect(parsePickerId('gpt-5.2-fast-1m')).toEqual({
      base: 'gpt-5.2',
      fast: true,
      contextTier: '1m',
      contextTokens: 1_000_000,
    })
    expect(parsePickerId('claude-4.6-sonnet-1m')).toEqual({
      base: 'claude-4.6-sonnet',
      fast: false,
      contextTier: '1m',
      contextTokens: 1_000_000,
    })
  })

  it('leaves product names like -max and unknown suffixes alone', () => {
    expect(parsePickerId('kimi-k3-max')).toEqual({
      base: 'kimi-k3-max',
      fast: false,
      contextTier: null,
    })
    expect(parsePickerId('llama-preview')).toEqual({
      base: 'llama-preview',
      fast: false,
      contextTier: null,
    })
  })
})

describe('groupFamilies', () => {
  const families = groupFamilies(groups)

  it('collapses suffix siblings into one family and keeps -max as its own base', () => {
    const sol = families.find(family => family.base === 'gpt-5.6-sol')
    expect(sol?.members.map(member => member.model.id)).toEqual([
      'gpt-5.6-sol',
      'gpt-5.6-sol-fast',
      'gpt-5.6-sol-1m',
      'gpt-5.6-sol-1m-fast',
      'gpt-5.6-sol-272k',
    ])
    expect(sol?.name).toBe('GPT-5.6 Sol')
    expect(families.find(family => family.base === 'kimi-k3-max')?.members).toHaveLength(1)
  })

  it('groups Cursor Fast and Max rows that put Fast before the context suffix', () => {
    const cursor = groupFamilies([{
      id: 'cursor',
      name: 'Cursor',
      models: [
        { id: 'gpt-5.2', name: 'GPT-5.2', reasoning },
        { id: 'gpt-5.2-fast', name: 'GPT-5.2 Fast', reasoning },
        { id: 'gpt-5.2-1m', name: 'GPT-5.2 Max', reasoning },
        { id: 'gpt-5.2-fast-1m', name: 'GPT-5.2 Fast Max', reasoning },
        { id: 'claude-4.6-sonnet', name: 'Claude 4.6 Sonnet', reasoning },
        { id: 'claude-4.6-sonnet-1m', name: 'Claude 4.6 Sonnet Max', reasoning },
      ],
    }])
    const gpt = cursor.find(family => family.base === 'gpt-5.2')
    expect(gpt?.name).toBe('GPT-5.2')
    expect(gpt?.members.map(member => member.model.id)).toEqual([
      'gpt-5.2',
      'gpt-5.2-fast',
      'gpt-5.2-1m',
      'gpt-5.2-fast-1m',
    ])
    expect(familyHasFast(gpt!)).toBe(true)
    expect(familyHasContextChoices(gpt!)).toBe(true)
    expect(pickVariant(gpt!, gpt!.members[0]!, { fast: true, contextTier: '1m' }).model.id).toBe('gpt-5.2-fast-1m')
    const claude = cursor.find(family => family.base === 'claude-4.6-sonnet')
    expect(claude?.name).toBe('Claude 4.6 Sonnet')
    expect(familyHasFast(claude!)).toBe(false)
    expect(familyHasContextChoices(claude!)).toBe(true)
  })

  it('exposes Fast and context rows only when real siblings exist', () => {
    const sol = families.find(family => family.base === 'gpt-5.6-sol')!
    expect(familyHasFast(sol)).toBe(true)
    expect(familyHasContextChoices(sol)).toBe(true)
    expect(contextTiers(sol).map(row => row.label)).toEqual(['272K', '1M'])
    expect(contextTiers(sol, 272_000).map(row => row.label)).toEqual(['272K', '1M'])
    const kimi = families.find(family => family.base === 'kimi-k3-max')!
    expect(familyHasFast(kimi)).toBe(false)
    expect(familyHasContextChoices(kimi)).toBe(false)
  })

  it('derives the selected context label from the model identity, not stale session pressure', () => {
    const sol = families.find(family => family.base === 'gpt-5.6-sol')!
    const standard = sol.members.find(member => member.model.id === 'gpt-5.6-sol')!
    const large = sol.members.find(member => member.model.id === 'gpt-5.6-sol-1m')!

    expect(contextLabelForMember(sol, standard)).toBe('272K')
    expect(contextLabelForMember(sol, large)).toBe('1M')
  })

  it('picks Fast / context siblings while keeping the other axis', () => {
    const sol = families.find(family => family.base === 'gpt-5.6-sol')!
    const standard = sol.members[0]!
    const fast = pickVariant(sol, standard, { fast: true })
    expect(fast.model.id).toBe('gpt-5.6-sol-fast')
    const large = pickVariant(sol, fast, { contextTier: '1m' })
    expect(large.model.id).toBe('gpt-5.6-sol-1m-fast')
  })

  it('hides Thinking unless on/off siblings share Fast and context', () => {
    const sol = families.find(family => family.base === 'gpt-5.6-sol')!
    expect(thinkingSiblings(sol, sol.members[0]!)).toBeNull()
    const qwen = findFamily(families, 'ollama-cloud', 'qwen3')!
    expect(thinkingSiblings(qwen, qwen.members[0]!)).toBeNull()
  })

  it('filters families by local search', () => {
    expect(filterFamilies(families, 'sol').map(family => family.base)).toEqual(['gpt-5.6-sol'])
    expect(filterFamilies(families, 'OLLAMA').map(family => family.base)).toEqual(['kimi-k3-max', 'qwen3', 'qwen3-thinking'])
  })

  it('builds a Host selection from a member', () => {
    const sol = families.find(family => family.base === 'gpt-5.6-sol')!
    expect(selectionOf(sol, sol.members[0]!)).toEqual({
      provider: 'codex',
      model: 'gpt-5.6-sol',
      reasoningEffort: 'high',
    })
  })
})
