import { describe, expect, it } from 'vitest'
import { sortCatalogGroupsWithRoutes } from '../../src/client/provider-directory.ts'

describe('chat picker provider order', () => {
  it('places saved llm routes first and keeps unknown catalog groups after', () => {
    const groups = [
      { id: 'deepseek-official', name: 'DeepSeek', models: [] },
      { id: 'cursor', name: 'Cursor', models: [] },
      { id: 'grok', name: 'Grok', models: [] },
    ]
    expect(sortCatalogGroupsWithRoutes(groups, ['llm-grok', 'llm-cursor'], { grok: 'llm-grok', cursor: 'llm-cursor' }).map(group => group.id)).toEqual([
      'grok',
      'cursor',
      'deepseek-official',
    ])
  })

  it('follows saved card order for a live Agent catalog id', () => {
    const groups = [
      { id: 'codex', name: 'Codex', models: [] },
      { id: 'antigravity', name: 'Antigravity', models: [] },
    ]
    expect(sortCatalogGroupsWithRoutes(groups, ['antigravity', 'llm-codex'], { antigravity: 'antigravity', codex: 'llm-codex' }).map(group => group.id)).toEqual([
      'antigravity',
      'codex',
    ])
  })

  it('falls back to published 0.2.8 LLM-only ranking when no live routes exist', () => {
    const groups = [
      { id: 'codex', name: 'Codex', models: [] },
      { id: 'antigravity', name: 'Antigravity', models: [] },
    ]
    expect(sortCatalogGroupsWithRoutes(groups, ['antigravity', 'llm-codex']).map(group => group.id)).toEqual([
      'codex',
      'antigravity',
    ])
  })

  it('keeps catalog order when a live map exists but no card order is saved', () => {
    const groups = [
      { id: 'codex', name: 'Codex', models: [] },
      { id: 'antigravity', name: 'Antigravity', models: [] },
    ]
    expect(sortCatalogGroupsWithRoutes(groups, [], { antigravity: 'antigravity', codex: 'llm-codex' }).map(group => group.id)).toEqual([
      'codex',
      'antigravity',
    ])
  })

  it('does not treat Object.prototype names as live catalog keys', () => {
    expect(sortCatalogGroupsWithRoutes(
      [{ id: 'toString' }, { id: 'cursor' }],
      ['llm-cursor'],
      { cursor: 'llm-cursor' },
    ).map(group => group.id)).toEqual(['cursor', 'toString'])
  })
})
