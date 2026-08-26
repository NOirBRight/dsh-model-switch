/**
 * Suffix grammar for composer picker grouping. Provider plugins own the wire
 * peel; this module only reads catalog ids.
 */
/** Trailing Fast row. */
export declare const FAST_SUFFIX = "-fast";
/** Parsed picker id after stripping Fast and a numeric context tier. */
export interface ParsedPickerId {
    /** Family key after peeling Fast and `-<n>k` / `-<n>m`. */
    base: string;
    /** Whether this row is the Fast sibling. */
    fast: boolean;
    /** Context suffix without the leading dash, or null for the standard row. */
    contextTier: string | null;
    /** Compaction budget implied by the suffix. */
    contextTokens?: number;
}
/** One catalog model as the Host directory projects it. */
export interface CatalogModelView {
    id: string;
    name: string;
    description?: string;
    reasoning?: {
        defaultEffort?: string;
        efforts: readonly {
            id: string;
            name: string;
            description?: string;
        }[];
    };
}
/** One provider group from the Host directory. */
export interface CatalogGroupView {
    id: string;
    name: string;
    models: readonly CatalogModelView[];
}
/** One catalog row inside a suffix family. */
export interface FamilyMember {
    model: CatalogModelView;
    fast: boolean;
    contextTier: string | null;
    contextTokens?: number;
    thinking: boolean;
}
/** Same-base rows across Fast / context / thinking siblings. */
export interface ModelFamily {
    provider: string;
    providerName: string;
    base: string;
    name: string;
    members: FamilyMember[];
}
/** Peel Fast and `-<n>k` / `-<n>m` in either order. Product names like `-max` stay. */
export declare function parsePickerId(id: string): ParsedPickerId;
/** Catalog id for a standard-row window that the Host did not publish. UI localizes this. */
export declare const STANDARD_CONTEXT_LABEL = "standard";
/** Human label for a context tier: 1M, 272K, or STANDARD_CONTEXT_LABEL when its window is unknown. */
export declare function contextTierLabel(tier: string | null, tokens?: number): string;
/** Compact token window for trigger / context-cell copy. */
export declare function formatWindow(tokens: number): string;
/** Standard-row window when the Host directory omits contextWindow. */
export declare function impliedStandardTokens(base: string): number | undefined;
/** Label a selected variant from catalog identity, never from stale session pressure. */
export declare function contextLabelForMember(family: ModelFamily, member: FamilyMember): string;
/** Group directory rows by provider + peeled base. */
export declare function groupFamilies(groups: readonly CatalogGroupView[]): ModelFamily[];
/** Locate the family that owns a provider/model pair. */
export declare function findFamily(families: readonly ModelFamily[], provider: string, modelId: string): ModelFamily | undefined;
/** Locate one family member by catalog id. */
export declare function findMember(family: ModelFamily, modelId: string): FamilyMember | undefined;
export interface VariantPatch {
    fast?: boolean;
    contextTier?: string | null;
    thinking?: boolean;
}
/** Pick a sibling after toggling Fast / context / thinking, keeping the other axes. */
export declare function pickVariant(family: ModelFamily, current: FamilyMember, patch: VariantPatch): FamilyMember;
/** Fast row appears only when both a Fast and a non-Fast sibling exist. */
export declare function familyHasFast(family: ModelFamily): boolean;
/** Provider sections in catalog order, for the model pane. */
export declare function sectionFamilies(families: readonly ModelFamily[]): Array<{
    provider: string;
    providerName: string;
    families: ModelFamily[];
}>;
/** Unique context tiers in catalog order. */
export declare function contextTiers(family: ModelFamily, standardTokens?: number): Array<{
    tier: string | null;
    label: string;
    tokens?: number;
}>;
/** Context row appears only when the family has more than one tier. */
export declare function familyHasContextChoices(family: ModelFamily): boolean;
/** Thinking on/off siblings at the current Fast + context axes, or null. */
export declare function thinkingSiblings(family: ModelFamily, current: FamilyMember): {
    on: FamilyMember;
    off: FamilyMember;
} | null;
/** Case-insensitive local search over family name, base, and provider. */
export declare function filterFamilies(families: readonly ModelFamily[], query: string): ModelFamily[];
export interface ModelSelectionView {
    provider: string;
    model: string;
    reasoningEffort?: string;
}
/** Build a Host selection from a member, preserving or defaulting effort. */
export declare function selectionOf(family: ModelFamily, member: FamilyMember, reasoningEffort?: string): ModelSelectionView;
