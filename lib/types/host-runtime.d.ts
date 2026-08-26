import { Context, Service } from '@deepseek-ai/cordis';
import type { ModelSelection } from '@deepseek-ai/dsh-agent';
import type { AgentDefaultModelConfig } from '@deepseek-ai/dsh-agent-default-model';
import { Config, type Config as ModelSwitchSettings } from './host-settings.js';
import { ModelSwitchAdapterRegistry } from './adapter-registry.js';
declare module '@deepseek-ai/cordis' {
    interface Context {
        modelSwitch: ModelSwitchRuntime;
    }
}
/** Host owner for Model Switch settings and the released Main-default adapter. */
export declare class ModelSwitchRuntime extends Service {
    static inject: string[];
    static Config: import("@deepseek-ai/schemastery").default<Config>;
    readonly capabilities: Readonly<{
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
        searchProviderAdapters: Readonly<{
            available: true;
            providers: readonly string[];
        }>;
        visionProviderAdapters: Readonly<{
            available: false;
            reason: "vision-provider-adapters";
        }>;
        imageProviderAdapters: Readonly<{
            available: true;
            providers: readonly string[];
        }>;
    }>;
    readonly adapters: ModelSwitchAdapterRegistry;
    private source;
    constructor(ctx: Context, entry: ModelSwitchSettings);
    currentSettings(): ModelSwitchSettings;
    currentMainSelection(): ModelSelection;
    saveMainSelection(selection: ModelSelection): Promise<void>;
}
export interface MainDefaultPort {
    currentSelection(): ModelSelection;
    saveSelection(selection: ModelSelection): Promise<void>;
}
export declare function mainDefaultPort(service: AgentDefaultModelConfig): MainDefaultPort;
