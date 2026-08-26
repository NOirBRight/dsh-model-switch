import { type CapabilityCatalog, type ModelSelection, type ReasoningEffortId } from './capabilities.js';
import type { MainSettingsDocument } from './main-settings.js';
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
export interface SubagentRouteSnapshot {
    version: 1;
    source: 'parent-request-header' | 'main-fallback' | 'fixed-policy' | 'workflow-override';
    selection: ModelSelection;
}
export interface CreateSubagentRouteInput {
    policy: SubagentRoutePolicy;
    parentRequestHeaderSelection?: ModelSelection;
    main: MainSettingsDocument;
    workflowOverride?: WorkflowRouteOverride;
}
export declare function createSubagentRouteSnapshot(catalog: CapabilityCatalog, input: CreateSubagentRouteInput): SubagentRouteSnapshot;
export declare function restoreSubagentRouteSnapshot(catalog: CapabilityCatalog, input: unknown): SubagentRouteSnapshot;
