import { type PluginRpcClient } from './plugin-rpc.ts';
/** DSH-parent subagent access to the Antigravity Enabled catalog. */
import type { ModelProviderGroup } from '@deepseek-ai/dsh-api-session-controller/types';
/** Provider key owned by the Antigravity card. */
export declare const ANTIGRAVITY_PROVIDER_KEY = "antigravity";
/** Agent role owned by ProviderDirectory (dsh-llm-providers-ui), never hardcoded by Model Switch. */
export declare const AGENT_ROLE = "agent";
/**
 * Antigravity's authenticated plugin route; this plugin has no build dependency on its owner.
 */
export declare const ANTIGRAVITY_CATALOG_METHOD = "plugin-rpc/antigravity";
export declare const ANTIGRAVITY_CATALOG_ENDPOINT = "catalog";
/** Decode the Enabled-catalog payload; anything malformed decodes to no groups. */
export declare function decodeAntigravityCatalogGroups(value: unknown): ModelProviderGroup[];
/**
 * Read the Enabled catalog; resolves to no groups when Antigravity is absent,
 * unreachable, or malformed. Never throws: the Host catalog stays authoritative.
 */
export declare function fetchAntigravityCatalogGroups(rpc: PluginRpcClient | undefined): Promise<ModelProviderGroup[]>;
/** Overlay Enabled-catalog groups onto the Host catalog without duplicating ids. */
export declare function withAntigravityCatalog(base: readonly ModelProviderGroup[], extra: readonly ModelProviderGroup[]): ModelProviderGroup[];
/** Read one Provider role from the owner directory; undefined when the seam is absent. */
export declare function readProviderRole(directory: unknown, key: string): string | undefined;
/** Whether a ProviderDirectory-owned role marks an Agent provider. */
export declare function isAgentRole(role: string | undefined): boolean;
/** Resolve a stored native `…-high|medium|low` id to the collapsed catalog row. */
export declare function matchCatalogModel(models: readonly ModelProviderGroup['models'][number][], modelId: string | undefined): {
    model: ModelProviderGroup['models'][number];
    effort?: string;
} | undefined;
