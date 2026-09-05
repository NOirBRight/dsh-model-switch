import z from '@deepseek-ai/schemastery';
export type SubagentMode = 'follow-main' | 'fixed';
export interface Config {
    subagentMode: SubagentMode;
    subagentProvider?: string;
    subagentModel?: string;
    subagentReasoningEffort?: string;
    searchProvider?: string;
    searchModel?: string;
    imageProvider?: string;
    imageModel?: string;
}
/** Stable lowercase namespace required by the Alpha.4 Settings provider. */
export declare const MODEL_SWITCH_SETTINGS_NAMESPACE = "model-switch";
export declare const Config: z<Config>;
export declare const DEFAULT_CONFIG: Config;
