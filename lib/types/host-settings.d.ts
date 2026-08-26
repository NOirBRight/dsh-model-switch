import z from '@deepseek-ai/schemastery';
export type SubagentMode = 'follow-main' | 'fixed';
export interface Config {
    subagentMode: SubagentMode;
    subagentProvider?: string;
    subagentModel?: string;
    subagentReasoningEffort?: string;
}
export declare const MODEL_SWITCH_SETTINGS_NAMESPACE: import("@deepseek-ai/dsh-settings").SettingsNamespace;
export declare const Config: z<Config>;
export declare const DEFAULT_CONFIG: Config;
