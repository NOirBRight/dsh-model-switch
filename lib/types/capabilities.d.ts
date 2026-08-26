import { ReasoningEffortId } from '@deepseek-ai/dsh-llm';
import type { ModelSelection } from '@deepseek-ai/dsh-agent';
export type { ModelSelection, ReasoningEffortId };
export type ModelCapability = 'chat' | 'search' | 'vision' | 'image';
export interface ModelCapabilities {
    capabilities: readonly ModelCapability[];
    reasoningEfforts?: readonly ReasoningEffortId[];
    defaultReasoningEffort?: ReasoningEffortId;
}
export interface ProviderCapabilities {
    models: Readonly<Record<string, ModelCapabilities>>;
}
export interface CapabilityCatalog {
    providers: Readonly<Record<string, ProviderCapabilities>>;
}
export declare class CapabilityValidationError extends Error {
    readonly name = "CapabilityValidationError";
}
export declare function parseReasoningEffortId(value: unknown, label?: string): ReasoningEffortId;
export declare function defineCapabilityCatalog(catalog: CapabilityCatalog): CapabilityCatalog;
export declare function validateModelSelection(catalog: CapabilityCatalog, input: unknown, requiredCapability?: ModelCapability): ModelSelection;
export declare function resolveDefaultEffort(catalog: CapabilityCatalog, selection: ModelSelection): ModelSelection;
