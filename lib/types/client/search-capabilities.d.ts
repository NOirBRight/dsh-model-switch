/** Host-owned search capability metadata, decoded at the Connection trust seam. */
import type { ModelProviderGroup } from '@deepseek-ai/dsh-api-session-controller/types';
import type { SearchProviderMetadata } from '../adapter-registry.js';
import type { CapabilitiesSnapshot } from '../capabilities-rpc.js';
import type { RuntimeCapabilities } from '../runtime-capabilities.js';
export type { CapabilitiesSnapshot };
/**
 * Strictly decode the Host search catalog into fresh plain metadata. Any malformed
 * entry fails the whole catalog (undefined): when the Host claims search is
 * available, invalid config must surface as an error, never hide as dropped rows.
 * Extra fields (functions, credentials) never survive: only id/name copy over.
 */
export declare function decodeSearchCatalog(value: unknown): SearchProviderMetadata[] | undefined;
/**
 * Strictly decode one capabilities long-poll value; undefined when untrusted.
 * Only the decoded search block is taken from the network and overlaid onto the
 * frozen local defaults: no arbitrary Host fields pass through.
 */
export declare function decodeCapabilitiesSnapshot(value: unknown): CapabilitiesSnapshot | undefined;
/** Project already-validated Host search metadata onto group shape (no re-decode). */
export declare function searchGroupsFromCapabilities(capabilities: RuntimeCapabilities | undefined): ModelProviderGroup[];
