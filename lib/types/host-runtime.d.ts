import { Context, Service } from '@deepseek-ai/cordis';
import type { ModelSelection } from '@deepseek-ai/dsh-agent';
import type { AgentDefaultModelConfig } from '@deepseek-ai/dsh-agent-default-model';
import { type Config as ModelSwitchSettingsConfig, type ModelSwitchSettings } from './host-settings.js';
import { ModelSwitchAdapterRegistry } from './adapter-registry.js';
declare module '@deepseek-ai/cordis' {
    interface Context {
        modelSwitch: ModelSwitchRuntime;
    }
}
/** Host owner for Model Switch settings and the released Main-default adapter. */
export declare class ModelSwitchRuntime extends Service {
    static inject: string[];
    static Config: import("@deepseek-ai/schemastery").default<Schemastery.ObjectS<NoInfer<{
        subagentMode: import("@deepseek-ai/schemastery").default<"follow-main" | "fixed", "follow-main" | "fixed", "volatile-defined">;
        subagentProvider: import("@deepseek-ai/schemastery").default<string, string, "volatile">;
        subagentModel: import("@deepseek-ai/schemastery").default<string, string, "volatile">;
        subagentReasoningEffort: import("@deepseek-ai/schemastery").default<string, string, "volatile">;
        searchProvider: import("@deepseek-ai/schemastery").default<string, string, "volatile">;
        searchModel: import("@deepseek-ai/schemastery").default<string, string, "volatile">;
        imageProvider: import("@deepseek-ai/schemastery").default<string, string, "volatile">;
        imageModel: import("@deepseek-ai/schemastery").default<string, string, "volatile">;
        compactOnSwitch: import("@deepseek-ai/schemastery").default<boolean, boolean, "volatile-defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
        subagentMode: import("@deepseek-ai/schemastery").default<"follow-main" | "fixed", "follow-main" | "fixed", "volatile-defined">;
        subagentProvider: import("@deepseek-ai/schemastery").default<string, string, "volatile">;
        subagentModel: import("@deepseek-ai/schemastery").default<string, string, "volatile">;
        subagentReasoningEffort: import("@deepseek-ai/schemastery").default<string, string, "volatile">;
        searchProvider: import("@deepseek-ai/schemastery").default<string, string, "volatile">;
        searchModel: import("@deepseek-ai/schemastery").default<string, string, "volatile">;
        imageProvider: import("@deepseek-ai/schemastery").default<string, string, "volatile">;
        imageModel: import("@deepseek-ai/schemastery").default<string, string, "volatile">;
        compactOnSwitch: import("@deepseek-ai/schemastery").default<boolean, boolean, "volatile-defined">;
    }>>, "plain">;
    get capabilities(): {
        searchProviderAdapters: {
            available: boolean;
            providers: string[];
            catalog: readonly import("./adapter-registry.js").SearchProviderMetadata[];
        };
        mainDefaults: Readonly<{
            available: true;
        }>;
        settings: Readonly<{
            available: true;
        }>;
        centralSubagentRouting: Readonly<{
            available: true;
        }>;
        packagedPresetRoots: Readonly<{
            available: false;
            reason: "packaged-preset-roots";
        }>;
        toolOwnerSuppression: Readonly<{
            available: false;
            reason: "tool-owner-suppression";
        }>;
        visionProviderAdapters: Readonly<{
            available: false;
            reason: "vision-provider-adapters";
        }>;
        imageProviderAdapters: Readonly<{
            available: true;
            providers: readonly string[];
        }>;
    };
    readonly adapters: ModelSwitchAdapterRegistry;
    private source;
    constructor(ctx: Context, entry: ModelSwitchSettingsConfig);
    currentSettings(): ModelSwitchSettings;
    currentMainSelection(): ModelSelection;
    saveMainSelection(selection: ModelSelection): Promise<void>;
}
export interface MainDefaultPort {
    currentSelection(): ModelSelection;
    saveSelection(selection: ModelSelection): Promise<void>;
}
export declare function mainDefaultPort(service: AgentDefaultModelConfig): MainDefaultPort;
