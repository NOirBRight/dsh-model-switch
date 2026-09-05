import { readFileSync } from 'node:fs'
import { load } from 'js-yaml'
import { expect, it } from 'vitest'

it('routes the global Web search entry through Model Switch without changing fetch', () => {
  const patch = load(readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')) as Array<{ id?: string; config?: Record<string, unknown> }>
  const web = patch.find(entry => entry.id === 'web')
  expect(web?.config).toEqual({ searchProvider: 'model-switch' })
})
