import type { Context } from '@deepseek-ai/cordis';
import type { WebSearchRequest, WebSearchResult } from '@deepseek-ai/dsh-web';
import type { ModelSwitchSearchAdapter, SearchModel } from './adapter-registry.js';
export declare const DEEPSEEK_SEARCH_MODELS: readonly SearchModel[];
export declare class DeepSeekSearchAdapter implements ModelSwitchSearchAdapter {
    private readonly ctx;
    readonly provider = "deepseek-official";
    readonly label = "DeepSeek";
    readonly models: readonly SearchModel[];
    constructor(ctx: Context);
    supportsModel(model: string): boolean;
    search(model: string, request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult>;
}
export declare function installDeepSeekSearchAdapter(ctx: Context): void;
