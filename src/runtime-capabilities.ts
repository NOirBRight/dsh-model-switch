export type RuntimeCapabilityReason = 'central-subagent-routing' | 'packaged-preset-roots' | 'tool-owner-suppression' | 'search-provider-adapters' | 'vision-provider-adapters' | 'image-provider-adapters'
export interface RuntimeCapability { readonly available: boolean; readonly reason?: RuntimeCapabilityReason; readonly providers?: readonly string[] }
export interface RuntimeCapabilities {
  readonly mainDefaults: RuntimeCapability; readonly settings: RuntimeCapability; readonly centralSubagentRouting: RuntimeCapability; readonly packagedPresetRoots: RuntimeCapability; readonly toolOwnerSuppression: RuntimeCapability
  readonly searchProviderAdapters: RuntimeCapability; readonly visionProviderAdapters: RuntimeCapability; readonly imageProviderAdapters: RuntimeCapability
}
export const RUNTIME_CAPABILITIES = Object.freeze({
  mainDefaults: Object.freeze({ available: true }), settings: Object.freeze({ available: true }),
  centralSubagentRouting: Object.freeze({ available: true }),
  packagedPresetRoots: Object.freeze({ available: false, reason: 'packaged-preset-roots' as const }),
  toolOwnerSuppression: Object.freeze({ available: false, reason: 'tool-owner-suppression' as const }),
  searchProviderAdapters: Object.freeze({ available: false, reason: 'tool-owner-suppression' as const }),
  visionProviderAdapters: Object.freeze({ available: false, reason: 'vision-provider-adapters' as const }),
  imageProviderAdapters: Object.freeze({ available: false, reason: 'image-provider-adapters' as const }),
}) satisfies RuntimeCapabilities
