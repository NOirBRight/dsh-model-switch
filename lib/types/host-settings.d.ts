import type { Volatile } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export type SubagentMode = 'follow-main' | 'fixed';
/** Resolved live values consumed by Model Switch. */
export interface ModelSwitchSettings {
    subagentMode: SubagentMode;
    subagentProvider?: string;
    subagentModel?: string;
    subagentReasoningEffort?: string;
    searchProvider?: string;
    searchModel?: string;
    imageProvider?: string;
    imageModel?: string;
    compactOnSwitch: boolean;
}
/** Loader-owned references; every field is directly editable in the profile form. */
export interface Config {
    subagentMode: Volatile<SubagentMode>;
    subagentProvider: Volatile<string | undefined>;
    subagentModel: Volatile<string | undefined>;
    subagentReasoningEffort: Volatile<string | undefined>;
    searchProvider: Volatile<string | undefined>;
    searchModel: Volatile<string | undefined>;
    imageProvider: Volatile<string | undefined>;
    imageModel: Volatile<string | undefined>;
    compactOnSwitch: Volatile<boolean>;
}
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    subagentMode: z<"follow-main" | "fixed", "follow-main" | "fixed", "volatile-defined">;
    subagentProvider: z<string, string, "volatile">;
    subagentModel: z<string, string, "volatile">;
    subagentReasoningEffort: z<string, string, "volatile">;
    searchProvider: z<string, string, "volatile">;
    searchModel: z<string, string, "volatile">;
    imageProvider: z<string, string, "volatile">;
    imageModel: z<string, string, "volatile">;
    compactOnSwitch: z<boolean, boolean, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    subagentMode: z<"follow-main" | "fixed", "follow-main" | "fixed", "volatile-defined">;
    subagentProvider: z<string, string, "volatile">;
    subagentModel: z<string, string, "volatile">;
    subagentReasoningEffort: z<string, string, "volatile">;
    searchProvider: z<string, string, "volatile">;
    searchModel: z<string, string, "volatile">;
    imageProvider: z<string, string, "volatile">;
    imageModel: z<string, string, "volatile">;
    compactOnSwitch: z<boolean, boolean, "volatile-defined">;
}>>, "plain">;
export declare function readConfig(config: Config): ModelSwitchSettings;
