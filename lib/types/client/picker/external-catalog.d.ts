import type { ModelSelection } from '@deepseek-ai/dsh-api-session-controller/types';
import type { PickerDirectorySnapshot, PickerDirectoryStore } from './PickerDirectory.ts';
type CatalogGroup = PickerDirectorySnapshot['groups'][number];
/** Overlay groups from External Agent catalog onto the LLM session.models snapshot. */
export declare function mergePickerGroups(base: readonly CatalogGroup[], extra: readonly CatalogGroup[]): CatalogGroup[];
export declare function overlayPickerSnapshot(base: PickerDirectorySnapshot, extra: readonly CatalogGroup[], current: ModelSelection | null): PickerDirectorySnapshot;
/** Subscribe-able overlay that hides unready External Agent groups by simply omitting them. */
export declare function createExternalCatalogStore(base: PickerDirectoryStore): {
    store: PickerDirectoryStore;
    setExtra(groups: readonly CatalogGroup[]): void;
    setCurrent(current: ModelSelection | null): void;
    extraIds(): ReadonlySet<string>;
};
export {};
