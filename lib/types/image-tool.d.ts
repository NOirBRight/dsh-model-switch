import type { Context } from '@deepseek-ai/cordis';
import type { ModelSwitchAdapterRegistry } from './adapter-registry.js';
export declare const GENERATE_IMAGE_TOOL_NAME = "generate_image";
interface ImageSettings {
    readonly imageProvider?: string;
    readonly imageModel?: string;
}
export interface ImageToolRuntime {
    currentSettings(): ImageSettings;
    readonly adapters: ModelSwitchAdapterRegistry;
}
export interface ImageToolController {
    reconcile(): Promise<void>;
}
/** Registers one provider-specific schema and replaces it transactionally on Settings changes. */
export declare function installGenerateImageTool(ctx: Context, runtime: ImageToolRuntime): ImageToolController;
export {};
