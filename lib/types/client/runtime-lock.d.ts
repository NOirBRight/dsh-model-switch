/** Session execution-runtime lock from native binding and request activity. */
import { ANTIGRAVITY_PROVIDER_KEY } from './antigravity-catalog.ts';
/**
 * Antigravity activity RPC seam (dsh-acp-antigravity activity-contract).
 * Kept as literals: the Antigravity plugin is not a Model Switch dependency.
 */
export declare const ANTIGRAVITY_BINDING_CHANNEL = "/dsh-acp-antigravity";
export declare const ANTIGRAVITY_BINDING_ENDPOINT = "activity/binding";
export type RuntimeProviderLock = typeof ANTIGRAVITY_PROVIDER_KEY | null;
/** Lock read result: the bound provider, plus whether the read itself failed. */
export interface ProviderLockState {
    readonly provider: RuntimeProviderLock;
    readonly failed: boolean;
}
interface BindingRpc {
    call(channel: string, endpoint: string, payload: unknown, extra: undefined): Promise<{
        ok: boolean;
        value?: unknown;
    }>;
}
/**
 * Decode one activity/binding reply. null means unbound; anything else shaped
 * is a read error (never thrown: the picker stays authoritative on failure).
 */
export declare function decodeBindingProvider(value: unknown): RuntimeProviderLock | undefined;
/**
 * Read one session native binding; undefined when the plugin is absent,
 * unreachable, or malformed. Never throws.
 */
export declare function fetchSessionBinding(rpc: BindingRpc | undefined, sessionId: string): Promise<RuntimeProviderLock | undefined>;
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
}
/**
 * Existing DSH history cannot convert to an External Agent. Blank sessions
 * and already-bound native sessions keep their current Agent choice.
 */
export declare function agentProviderLocked(blank: boolean, bound: RuntimeProviderLock, active?: boolean): boolean;
/**
 * Whether one provider remains selectable under a lock read that may have failed.
 * Fail closed for native-bound sessions (known lock, or current Antigravity
 * selection with no successful read yet): only the anchor stays selectable.
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
export declare function effectiveProviderLock(state: ProviderLockState, currentProvider: string | undefined, active?: boolean): RuntimeProviderLock;
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
export {};
