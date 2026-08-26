import { resolveDefaultEffort, validateModelSelection, type CapabilityCatalog, type ModelSelection, type ReasoningEffortId } from './capabilities.js'
import type { MainSettingsDocument } from './main-settings.js'

export type SubagentRoutePolicy = { mode: 'follow-main' } | { mode: 'fixed'; route: ModelSelection }
export interface WorkflowRouteOverride { provider: string; model: string; effort?: ReasoningEffortId }
export interface SubagentRouteSnapshot {
  version: 1
  source: 'parent-request-header' | 'main-fallback' | 'fixed-policy' | 'workflow-override'
  selection: ModelSelection
}
export interface CreateSubagentRouteInput {
  policy: SubagentRoutePolicy
  parentRequestHeaderSelection?: ModelSelection
  main: MainSettingsDocument
  workflowOverride?: WorkflowRouteOverride
}

function parsePolicy(catalog: CapabilityCatalog, policy: SubagentRoutePolicy): SubagentRoutePolicy {
  if (policy.mode === 'follow-main') return { mode: 'follow-main' }
  if (policy.mode === 'fixed') return { mode: 'fixed', route: validateModelSelection(catalog, policy.route) }
  throw new Error('subagent policy mode must be follow-main or fixed')
}

function workflowSelection(override: WorkflowRouteOverride): ModelSelection {
  return override.effort === undefined
    ? { provider: override.provider, model: override.model }
    : { provider: override.provider, model: override.model, reasoningEffort: override.effort }
}

export function createSubagentRouteSnapshot(catalog: CapabilityCatalog, input: CreateSubagentRouteInput): SubagentRouteSnapshot {
  if (input.workflowOverride !== undefined) {
    return {
      version: 1,
      source: 'workflow-override',
      selection: resolveDefaultEffort(catalog, validateModelSelection(catalog, workflowSelection(input.workflowOverride))),
    }
  }
  const policy = parsePolicy(catalog, input.policy)
  if (policy.mode === 'fixed') return { version: 1, source: 'fixed-policy', selection: resolveDefaultEffort(catalog, policy.route) }
  if (input.parentRequestHeaderSelection !== undefined) {
    return {
      version: 1,
      source: 'parent-request-header',
      selection: resolveDefaultEffort(catalog, validateModelSelection(catalog, input.parentRequestHeaderSelection)),
    }
  }
  return {
    version: 1,
    source: 'main-fallback',
    selection: resolveDefaultEffort(catalog, validateModelSelection(catalog, input.main.defaultRoute)),
  }
}

export function restoreSubagentRouteSnapshot(catalog: CapabilityCatalog, input: unknown): SubagentRouteSnapshot {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new Error('subagent route snapshot must be an object')
  const value = input as Record<string, unknown>
  if (value.version !== 1) throw new Error('subagent route snapshot version must be 1')
  if (!['parent-request-header', 'main-fallback', 'fixed-policy', 'workflow-override'].includes(String(value.source))) {
    throw new Error('subagent route snapshot source is invalid')
  }
  return { version: 1, source: value.source as SubagentRouteSnapshot['source'], selection: validateModelSelection(catalog, value.selection) }
}
