import { describe, expect, it } from 'vitest'
import { createExternalCatalogStore, mergePickerGroups, overlayPickerSnapshot } from '../src/client/picker/external-catalog.ts'

const llm = { id: 'deepseek', name: 'DeepSeek', models: [{ id: 'v3', name: 'V3' }] }
const agy = { id: 'antigravity', name: 'Antigravity', models: [{ id: 'gemini', name: 'Gemini' }] }

describe('external catalog overlay', () => {
  it('appends ready External Agent groups without duplicating ids', () => {
    expect(mergePickerGroups([llm, agy], [agy])).toEqual([llm, agy])
    expect(mergePickerGroups([llm], [agy])).toEqual([llm, agy])
  })

  it('keeps an External Agent selection as current', () => {
    const next = overlayPickerSnapshot(
      { current: { provider: 'deepseek', model: 'v3' }, routable: true, groups: [llm], failures: [], status: 'ready', error: null },
      [agy],
      { provider: 'antigravity', model: 'gemini' },
    )
    expect(next.current).toEqual({ provider: 'antigravity', model: 'gemini' })
    expect(next.groups.map(group => group.id)).toEqual(['deepseek', 'antigravity'])
  })

  it('returns the same snapshot reference until extra groups change', () => {
    const baseSnap = { current: { provider: 'deepseek', model: 'v3' }, routable: true, groups: [llm], failures: [], status: 'ready' as const, error: null }
    const store = createExternalCatalogStore({ subscribe: () => () => undefined, getSnapshot: () => baseSnap })
    expect(store.store.getSnapshot()).toBe(store.store.getSnapshot())
    store.setExtra([])
    expect(store.store.getSnapshot()).toBe(store.store.getSnapshot())
    store.setExtra([agy])
    const withAgy = store.store.getSnapshot()
    expect(withAgy).toBe(store.store.getSnapshot())
    expect(withAgy.groups.map(group => group.id)).toEqual(['deepseek', 'antigravity'])
  })
})
