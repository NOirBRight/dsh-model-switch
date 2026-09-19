import { describe, expect, it } from 'vitest'
import { createSubagentRouteSnapshot, restoreSubagentRouteSnapshot } from '../src/subagent-route-policy.js'
import { catalog } from './fixtures.js'

describe('SubagentRoutePolicy', () => {
  it('follow-main does not produce a Model Switch-owned selection', () => {
    expect(createSubagentRouteSnapshot(catalog, { policy: { mode: 'follow-main' } }))
      .toEqual({ version: 1, source: 'official-inherit' })
  })
  it('fixed applies model default effort', () => {
    expect(createSubagentRouteSnapshot(catalog, { policy: { mode: 'fixed', route: { provider: 'codex', model: 'codex-chat' } } }))
      .toEqual({ version: 1, source: 'fixed-policy', selection: { provider: 'codex', model: 'codex-chat', reasoningEffort: 'standard' } })
  })
  it('maps workflow effort to reasoningEffort and explicit route overrides policy', () => {
    expect(createSubagentRouteSnapshot(catalog, { policy: { mode: 'fixed', route: { provider: 'deepseek', model: 'deep-chat' } }, workflowOverride: { provider: 'codex', model: 'codex-chat', effort: 'ultra' } }).selection)
      .toEqual({ provider: 'codex', model: 'codex-chat', reasoningEffort: 'ultra' })
  })
  it('workflow route uses target default effort when omitted', () => {
    expect(createSubagentRouteSnapshot(catalog, { policy: { mode: 'follow-main' }, workflowOverride: { provider: 'codex', model: 'codex-chat' } }))
      .toEqual({ version: 1, source: 'workflow-override', selection: { provider: 'codex', model: 'codex-chat', reasoningEffort: 'standard' } })
  })
  it('snapshots are JSON serializable and restore cold without policy reads', () => {
    const frozen = createSubagentRouteSnapshot(catalog, { policy: { mode: 'fixed', route: { provider: 'deepseek', model: 'deep-chat' } } })
    expect(restoreSubagentRouteSnapshot(catalog, JSON.parse(JSON.stringify(frozen)))).toEqual(frozen)
    expect(restoreSubagentRouteSnapshot(catalog, { version: 1, source: 'official-inherit' })).toEqual({ version: 1, source: 'official-inherit' })
    expect(restoreSubagentRouteSnapshot(catalog, { version: 1, source: 'main-fallback', selection: { provider: 'deepseek', model: 'deep-chat' } }))
      .toEqual({ version: 1, source: 'official-inherit' })
  })
  it('rejects invalid fixed, workflow, and cold routes', () => {
    expect(() => createSubagentRouteSnapshot(catalog, { policy: { mode: 'fixed', route: { provider: 'bad', model: 'x' } } })).toThrow('unknown provider')
    expect(() => createSubagentRouteSnapshot(catalog, { policy: { mode: 'follow-main' }, workflowOverride: { provider: 'bad', model: 'x' } })).toThrow('unknown provider')
    expect(() => restoreSubagentRouteSnapshot(catalog, { version: 1, source: 'fixed-policy', selection: { provider: 'bad', model: 'x' } })).toThrow('unknown provider')
  })
})
