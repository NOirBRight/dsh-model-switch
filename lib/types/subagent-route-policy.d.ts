import { type CapabilityCatalog, type ModelSelection, type ReasoningEffortId } from './capabilities.js';
export type SubagentRoutePolicy = {
    mode: 'follow-main';
} | {
    mode: 'fixed';
    route: ModelSelection;
};
export interface WorkflowRouteOverride {
    provider: string;
    model: string;
    effort?: ReasoningEffortId;
}
export type SubagentRouteSnapshot = {
    version: 1;
    source: 'fixed-policy' | 'workflow-override';
    selection: ModelSelection;
} | {
    version: 1;
    source: 'official-inherit';
};
export interface CreateSubagentRouteInput {
    policy: SubagentRoutePolicy;
    workflowOverride?: WorkflowRouteOverride;
}
export declare function createSubagentRouteSnapshot(catalog: CapabilityCatalog, input: CreateSubagentRouteInput): SubagentRouteSnapshot;
export declare function restoreSubagentRouteSnapshot(catalog: CapabilityCatalog, input: unknown): SubagentRouteSnapshot;
