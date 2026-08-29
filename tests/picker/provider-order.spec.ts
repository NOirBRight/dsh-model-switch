import { describe, expect, it } from 'vitest'
import { sortCatalogGroups } from 'dsh-llm-providers-ui/client'

describe('chat picker provider order', () => {
  it('places saved llm routes first and keeps unknown catalog groups after', () => {
    const groups = [
      { id: 'deepseek-official', name: 'DeepSeek', models: [] },
      { id: 'cursor', name: 'Cursor', models: [] },
      { id: 'grok', name: 'Grok', models: [] },
    ]
    expect(sortCatalogGroups(groups, ['llm-grok', 'llm-cursor']).map(group => group.id)).toEqual([
      'grok',
      'cursor',
      'deepseek-official',
    ])
  })
})
