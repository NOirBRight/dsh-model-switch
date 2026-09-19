import { resolveDefaultEffort, validateModelSelection, type CapabilityCatalog, type ModelSelection, type ReasoningEffortId } from './capabilities.js'

export type SubagentRoutePolicy = { mode: 'follow-main' } | { mode: 'fixed'; route: ModelSelection }
export interface WorkflowRouteOverride { provider: string; model: string; effort?: ReasoningEffortId }
export type SubagentRouteSnapshot =
  | { version: 1; source: 'fixed-policy' | 'workflow-override'; selection: ModelSelection }
  | { version: 1; source: 'official-inherit' }
export interface CreateSubagentRouteInput {
  policy: SubagentRoutePolicy
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
  return { version: 1, source: 'official-inherit' }
}

export function restoreSubagentRouteSnapshot(catalog: CapabilityCatalog, input: unknown): SubagentRouteSnapshot {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new Error('subagent route snapshot must be an object')
  const value = input as Record<string, unknown>
  if (value.version !== 1) throw new Error('subagent route snapshot version must be 1')
  const source = String(value.source)
  if (source === 'official-inherit' || source === 'parent-request-header' || source === 'main-fallback') {
    return { version: 1, source: 'official-inherit' }
  }
  if (source === 'fixed-policy' || source === 'workflow-override') {
    return { version: 1, source, selection: validateModelSelection(catalog, value.selection) }
  }
  throw new Error('subagent route snapshot source is invalid')
}
