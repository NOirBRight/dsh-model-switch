import { describe, expect, it } from 'vitest'
import { createSubagentRouteSnapshot, restoreSubagentRouteSnapshot } from '../src/subagent-route-policy.js'
import { catalog } from './fixtures.js'

const main = { version: 1 as const, defaultRoute: { provider: 'deepseek', model: 'deep-chat' } }

describe('SubagentRoutePolicy', () => {
  it('follow-main uses the latest parent request-header selection', () => {
    expect(createSubagentRouteSnapshot(catalog, { policy: { mode: 'follow-main' }, parentRequestHeaderSelection: { provider: 'codex', model: 'codex-chat', reasoningEffort: 'ultra' }, main }))
      .toEqual({ version: 1, source: 'parent-request-header', selection: { provider: 'codex', model: 'codex-chat', reasoningEffort: 'ultra' } })
  })
  it('follow-main falls back to global Main', () => {
    expect(createSubagentRouteSnapshot(catalog, { policy: { mode: 'follow-main' }, main }))
      .toEqual({ version: 1, source: 'main-fallback', selection: { provider: 'deepseek', model: 'deep-chat', reasoningEffort: 'off' } })
  })
  it('fixed ignores parent and applies model default effort', () => {
    expect(createSubagentRouteSnapshot(catalog, { policy: { mode: 'fixed', route: { provider: 'codex', model: 'codex-chat' } }, parentRequestHeaderSelection: { provider: 'deepseek', model: 'deep-chat', reasoningEffort: 'max' }, main }))
      .toEqual({ version: 1, source: 'fixed-policy', selection: { provider: 'codex', model: 'codex-chat', reasoningEffort: 'standard' } })
  })
  it('maps workflow effort to reasoningEffort and explicit route overrides policy', () => {
    expect(createSubagentRouteSnapshot(catalog, { policy: { mode: 'fixed', route: { provider: 'deepseek', model: 'deep-chat' } }, main, workflowOverride: { provider: 'codex', model: 'codex-chat', effort: 'ultra' } }).selection)
      .toEqual({ provider: 'codex', model: 'codex-chat', reasoningEffort: 'ultra' })
  })
  it('workflow route uses target default effort when omitted', () => {
    expect(createSubagentRouteSnapshot(catalog, { policy: { mode: 'follow-main' }, main, workflowOverride: { provider: 'codex', model: 'codex-chat' } }))
      .toEqual({ version: 1, source: 'workflow-override', selection: { provider: 'codex', model: 'codex-chat', reasoningEffort: 'standard' } })
  })
  it('snapshots are JSON serializable and restore cold without policy reads', () => {
    const frozen = createSubagentRouteSnapshot(catalog, { policy: { mode: 'follow-main' }, main })
    main.defaultRoute = { provider: 'codex', model: 'codex-chat' }
    expect(restoreSubagentRouteSnapshot(catalog, JSON.parse(JSON.stringify(frozen)))).toEqual(frozen)
  })
  it('rejects invalid fixed, parent, workflow, and cold routes', () => {
    expect(() => createSubagentRouteSnapshot(catalog, { policy: { mode: 'fixed', route: { provider: 'bad', model: 'x' } }, main })).toThrow('unknown provider')
    expect(() => createSubagentRouteSnapshot(catalog, { policy: { mode: 'follow-main' }, main, parentRequestHeaderSelection: { provider: 'bad', model: 'x' } })).toThrow('unknown provider')
    expect(() => createSubagentRouteSnapshot(catalog, { policy: { mode: 'follow-main' }, main, workflowOverride: { provider: 'bad', model: 'x' } })).toThrow('unknown provider')
    expect(() => restoreSubagentRouteSnapshot(catalog, { version: 1, source: 'fixed-policy', selection: { provider: 'bad', model: 'x' } })).toThrow('unknown provider')
  })
})
