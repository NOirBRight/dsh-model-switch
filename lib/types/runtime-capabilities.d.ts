export type RuntimeCapabilityReason = 'central-subagent-routing' | 'packaged-preset-roots' | 'tool-owner-suppression' | 'search-provider-adapters' | 'vision-provider-adapters' | 'image-provider-adapters';
export interface RuntimeCapability {
    readonly available: boolean;
    readonly reason?: RuntimeCapabilityReason;
    readonly providers?: readonly string[];
}
export interface RuntimeCapabilities {
    readonly mainDefaults: RuntimeCapability;
    readonly settings: RuntimeCapability;
    readonly centralSubagentRouting: RuntimeCapability;
    readonly packagedPresetRoots: RuntimeCapability;
    readonly toolOwnerSuppression: RuntimeCapability;
    readonly searchProviderAdapters: RuntimeCapability;
    readonly visionProviderAdapters: RuntimeCapability;
    readonly imageProviderAdapters: RuntimeCapability;
}
export declare const RUNTIME_CAPABILITIES: Readonly<{
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
        available: false;
        reason: "tool-owner-suppression";
    }>;
    visionProviderAdapters: Readonly<{
        available: false;
        reason: "vision-provider-adapters";
    }>;
    imageProviderAdapters: Readonly<{
        available: false;
        reason: "image-provider-adapters";
    }>;
}>;
