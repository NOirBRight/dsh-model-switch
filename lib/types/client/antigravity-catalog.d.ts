/** DSH-parent subagent access to the Antigravity Enabled catalog. */
import type { ModelProviderGroup } from '@deepseek-ai/dsh-api-session-controller/types';
/** Provider key owned by the Antigravity card. */
export declare const ANTIGRAVITY_PROVIDER_KEY = "antigravity";
/** Agent role owned by ProviderDirectory (dsh-llm-providers-ui), never hardcoded by Model Switch. */
export declare const AGENT_ROLE = "agent";
/**
 * Released Antigravity settings RPC seam (dsh-acp-antigravity client-contract).
 * Kept as literals: the Antigravity plugin is not a Model Switch dependency.
 */
export declare const ANTIGRAVITY_CATALOG_CHANNEL = "/dsh-acp-antigravity";
export declare const ANTIGRAVITY_CATALOG_ENDPOINT = "catalog";
interface CatalogRpc {
    call(channel: string, endpoint: string, payload: unknown, extra: undefined): Promise<{
        ok: boolean;
        value?: unknown;
    }>;
}
/** Decode the Enabled-catalog payload; anything malformed decodes to no groups. */
export declare function decodeAntigravityCatalogGroups(value: unknown): ModelProviderGroup[];
/**
 * Read the Enabled catalog; resolves to no groups when Antigravity is absent,
 * unreachable, or malformed. Never throws: the Host catalog stays authoritative.
 */
export declare function fetchAntigravityCatalogGroups(rpc: CatalogRpc | undefined): Promise<ModelProviderGroup[]>;
/** Overlay Enabled-catalog groups onto the Host catalog without duplicating ids. */
export declare function withAntigravityCatalog(base: readonly ModelProviderGroup[], extra: readonly ModelProviderGroup[]): ModelProviderGroup[];
/** Read one Provider role from the owner directory; undefined when the seam is absent. */
export declare function readProviderRole(directory: unknown, key: string): string | undefined;
/** Whether a ProviderDirectory-owned role marks an Agent provider. */
export declare function isAgentRole(role: string | undefined): boolean;
export {};
