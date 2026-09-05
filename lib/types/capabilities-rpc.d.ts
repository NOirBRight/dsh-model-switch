import type { Context } from '@deepseek-ai/cordis';
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection';
import type { ModelSwitchAdapterRegistry } from './adapter-registry.js';
import type { RuntimeCapabilities } from './runtime-capabilities.js';
export declare const CAPABILITIES_CHANNEL = "/model-switch";
export interface CapabilitiesSnapshot {
    readonly revision: number;
    readonly capabilities: RuntimeCapabilities;
}
/** Bounded long-poll on the existing registry; each caller owns and disposes its subscription. */
export declare function capabilitiesRpc(registry: ModelSwitchAdapterRegistry, snapshot: () => RuntimeCapabilities, lifetime: AbortSignal): ConnectionRpcHandler;
export declare function installCapabilitiesRpc(ctx: Context, registry: ModelSwitchAdapterRegistry, snapshot: () => RuntimeCapabilities): void;
