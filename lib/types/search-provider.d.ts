import type { Context } from '@deepseek-ai/cordis';
import type { WebSearchProvider, WebSearchRequest, WebSearchResult } from '@deepseek-ai/dsh-web';
import type { ModelSwitchAdapterRegistry } from './adapter-registry.js';
export declare const MODEL_SWITCH_SEARCH_PROVIDER_ID = "model-switch";
interface SearchSettings {
    readonly searchProvider?: string;
    readonly searchModel?: string;
}
/** Thin official WebSearchProvider that resolves Model Switch routing at execution time. */
export declare class ModelSwitchSearchProvider implements WebSearchProvider {
    private readonly settings;
    private readonly adapters;
    readonly id = "model-switch";
    constructor(settings: () => SearchSettings, adapters: ModelSwitchAdapterRegistry);
    available(): boolean;
    search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult>;
}
export interface SearchProviderRuntime {
    currentSettings(): SearchSettings;
    readonly adapters: ModelSwitchAdapterRegistry;
}
export declare function installModelSwitchSearchProvider(ctx: Context, runtime: SearchProviderRuntime): void;
export {};
