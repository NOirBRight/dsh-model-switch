/** Optional ProviderDirectory operations consumed by Model Switch. */
import type { NativeBindingSource } from './runtime-lock.ts';
/** Provider-directory operations that may be supplied by the Providers UI plugin. */
export interface ProviderDirectoryFace {
    subscribe(listener: () => void): () => void;
    roleOf?(key: string): string | undefined;
    catalogRoutes?(): Readonly<Record<string, string>>;
    nativeBindings?(): readonly NativeBindingSource[];
}
/** Read the optional catalog route map without assuming a particular Providers UI release. */
export declare function readCatalogRoutes(directory: ProviderDirectoryFace | undefined): Readonly<Record<string, string>>;
/** Read the optional native-binding declarations without assuming a particular Providers UI release. */
export declare function readNativeBindings(directory: ProviderDirectoryFace | undefined): readonly NativeBindingSource[];
/**
 * Rank picker/catalog groups from live ProviderDirectory routes.
 * Published 0.2.8 `sortCatalogGroups` only understands hardcoded LLM routes and
 * ignores a third argument, so Agent catalog ids would keep source order.
 * When the Owner publishes `catalogRoutes`, this ranks those keys locally.
 * With no live map, fall back to the compile-pinned 0.2.8 LLM-only sort.
 */
export declare function sortCatalogGroupsWithRoutes<T extends {
    id: string;
}>(groups: readonly T[], saved?: readonly string[], catalogKeys?: Readonly<Record<string, string>>): T[];
