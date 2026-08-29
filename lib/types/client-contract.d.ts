export declare const MODEL_SWITCH_SETTINGS_ID = "model-switch";
export declare const MAIN_SETTINGS_ID = "agent-default-model";
export interface MainSettingsView {
    provider: string;
    model: string;
    reasoningEffort?: string;
}
export declare class MainSettingsConflictError extends Error {
    readonly name = "MainSettingsConflictError";
}
export interface ModelSwitchSettingsView {
    subagentMode: 'follow-main' | 'fixed';
    subagentProvider?: string;
    subagentModel?: string;
    subagentReasoningEffort?: string;
    searchProvider?: string;
    searchModel?: string;
    imageProvider?: string;
    imageModel?: string;
}
export interface SubagentSettingsView {
    mode: 'follow-main' | 'fixed';
    provider?: string;
    model?: string;
    reasoningEffort?: string;
}
export interface CapabilityRouteView {
    provider?: string;
    model?: string;
}
export declare const SUBAGENT_SETTINGS_FIELDS: Readonly<{
    readonly mode: "subagentMode";
    readonly provider: "subagentProvider";
    readonly model: "subagentModel";
    readonly effort: "subagentReasoningEffort";
}>;
export declare const SEARCH_SETTINGS_FIELDS: Readonly<{
    readonly provider: "searchProvider";
    readonly model: "searchModel";
}>;
export declare const IMAGE_SETTINGS_FIELDS: Readonly<{
    readonly provider: "imageProvider";
    readonly model: "imageModel";
}>;
export declare function decodeMainSettings(value: unknown): MainSettingsView | undefined;
export declare function decodeModelSwitchSettings(value: unknown): ModelSwitchSettingsView | undefined;
export declare function deriveSubagentSettings(settings: ModelSwitchSettingsView): SubagentSettingsView;
export declare function deriveSearchSettings(settings: ModelSwitchSettingsView): CapabilityRouteView;
export declare function deriveImageSettings(settings: ModelSwitchSettingsView): CapabilityRouteView;
