import { type PluginRpcClient } from './plugin-rpc.ts';
/** Session execution-runtime lock from native binding and request activity. */
/** Native binding query declared by an installed Agent provider. */
export interface NativeBindingSource {
    readonly provider: string;
    readonly channel: string;
    readonly endpoint: string;
}
export type RuntimeProviderLock = string | null;
/** A known binding remains authoritative even if another query fails. */
export interface ProviderLockState {
    readonly provider: RuntimeProviderLock;
    readonly failed: boolean;
}
/** Decode a wire reply only for the provider that owns the query. */
export declare function decodeBindingProvider(value: unknown, provider: string): RuntimeProviderLock | undefined;
/** Query installed declarations; one failed query must never become a successful unbound read. */
export declare function fetchSessionBinding(rpc: PluginRpcClient | undefined, sessionId: string, sources: readonly NativeBindingSource[]): Promise<ProviderLockState>;
/** Whether one provider remains selectable under a known lock read. */
export declare function providerSelectable(lock: RuntimeProviderLock, provider: string): boolean;
/** Extra facts for Agent-role selection on blank vs existing DSH sessions. */
export interface ProviderAllowContext {
    /** Empty-log bit from the conversation snapshot; omit when unknown. */
    blank?: boolean;
    /** A prompt is being submitted, awaits its first turn, or is running. */
    active?: boolean;
    /** Whether the candidate provider is an Agent-role External Agent. */
    agent?: boolean;
    /** Whether the current selection is an Agent provider, from its declaration. */
    currentAgent?: boolean;
}
/**
 * Existing DSH history cannot convert to an External Agent. Blank sessions
 * and already-bound native sessions keep their current Agent choice.
 */
export declare function agentProviderLocked(blank: boolean, bound: RuntimeProviderLock, active?: boolean): boolean;
/** Picker allow-check over the already-effective lock and the agentLocked bit. */
export declare function runtimeChoiceAllowed(lock: RuntimeProviderLock, agentLocked: boolean, provider: string, currentProvider: string | undefined, agent: boolean): boolean;
/**
 * Whether one provider remains selectable under a lock read that may have failed.
 * Failed reads keep only the known binding or current selection selectable;
 * active Agent selections reserve their runtime before the first binding arrives.
 * Unbound sessions with DSH history cannot select a new Agent provider.
 * Log reading is never gated by this.
 * @param state - Latest lock read for the session.
 * @param provider - Candidate provider for the pending selection.
 * @param currentProvider - Session current provider, if any.
 * @param context - Session history, request activity, and candidate Agent role.
 */
export declare function isProviderAllowed(state: ProviderLockState, provider: string, currentProvider: string | undefined, context?: ProviderAllowContext): boolean;
/**
 * Effective single-provider lock for pickers that only understand
 * RuntimeProviderLock. Errors fail closed exactly as isProviderAllowed does.
 */
export declare function effectiveProviderLock(state: ProviderLockState, currentProvider: string | undefined, active?: boolean, currentAgent?: boolean): RuntimeProviderLock;
/** Minimal shared lock state: one snapshot per session, refreshed on demand. */
export interface ProviderLockStore {
    subscribe: (listener: () => void) => () => void;
    getSnapshot: () => ProviderLockState;
    /** Re-read; concurrent reads resolve in call order, stale ones are dropped. */
    refresh: () => Promise<ProviderLockState>;
}
/**
 * Create one session lock store over an injecting query.
 * The query sees the previous snapshot for sticky failure mapping and never
 * throws (failures resolve to failed reads); refresh never rejects.
 */
export declare function createProviderLockStore(query: (previous: ProviderLockState) => Promise<ProviderLockState>): ProviderLockStore;
