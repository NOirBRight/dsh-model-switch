import { readFileSync } from 'node:fs'
import { applyEntryPatches, type PatchOptions } from '@deepseek-ai/cordis-plugin-include'
import { load } from 'js-yaml'
import { expect, it } from 'vitest'

it('preserves existing global search and custom fetch pins through real patch composition', () => {
  const patch = load(readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')) as PatchOptions[]
  const entries = [
    { id: 'web', name: '@deepseek-ai/dsh-web', config: { searchProvider: 'previous-search', fetchProvider: 'custom-fetch' } },
    { id: 'subagent', name: '@deepseek-ai/dsh-subagent' },
  ]
  const composed = applyEntryPatches(entries, patch, message => { throw new Error(message) })
  expect(composed.find(entry => entry.id === 'web')?.config).toEqual({ searchProvider: 'previous-search', fetchProvider: 'custom-fetch' })
})
