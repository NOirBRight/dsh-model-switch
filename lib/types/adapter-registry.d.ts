import type { WebSearchRequest, WebSearchResult } from '@deepseek-ai/dsh-web';
export interface SearchModel {
    readonly id: string;
    readonly name: string;
}
export interface SearchProviderMetadata {
    readonly id: string;
    readonly name: string;
    readonly models: readonly SearchModel[];
}
export interface ModelSwitchSearchAdapter {
    readonly provider: string;
    readonly label?: string;
    /** Independent web_search models, not the conversational/native-network catalog. */
    readonly models?: readonly SearchModel[];
    supportsModel(model: string): boolean;
    search(model: string, request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult>;
}
export type ImageOutputFormat = 'png' | 'jpeg' | 'webp';
export interface ModelSwitchImageRequest {
    readonly prompt: string;
    readonly path?: string;
    readonly source?: string;
    readonly outputFormat?: ImageOutputFormat;
    readonly aspectRatio?: string;
}
export interface ModelSwitchGeneratedImage {
    readonly path: string;
    readonly mediaType: string;
    readonly width: number;
    readonly height: number;
    readonly bytes?: number;
    readonly attachmentId?: string;
    readonly name?: string;
    readonly revisedPrompt?: string;
}
export interface ModelSwitchImageAdapter {
    readonly provider: string;
    supportsModel(model: string): boolean;
    generate(model: string, request: ModelSwitchImageRequest, execution: unknown): Promise<ModelSwitchGeneratedImage>;
}
export interface ModelSwitchProviderAdapters {
    readonly provider: string;
    readonly search?: ModelSwitchSearchAdapter;
    readonly image?: ModelSwitchImageAdapter;
}
/** Lifecycle-owned registry for optional provider integrations. */
export declare class ModelSwitchAdapterRegistry {
    private readonly entries;
    private readonly listeners;
    subscribe(listener: () => void): () => void;
    private changed;
    /** Explicit projection: never serialize an executable adapter or its extra fields. */
    searchCatalog(): readonly SearchProviderMetadata[];
    register(adapters: ModelSwitchProviderAdapters): () => void;
    get(provider: string): ModelSwitchProviderAdapters | undefined;
    list(): readonly ModelSwitchProviderAdapters[];
}
