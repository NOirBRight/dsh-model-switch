import type { ModelSelection } from '@deepseek-ai/dsh-api-remotes/client';
import type { CatalogGroupView } from '../../picker/family.ts';
export interface PickerDirectorySnapshot {
    current: ModelSelection | null;
    groups: readonly CatalogGroupView[];
    failures: readonly {
        id: string;
        name: string;
        message: string;
    }[];
    status: string;
    error: string | null;
}
export interface PickerDirectoryStore {
    subscribe: (listener: () => void) => () => void;
    getSnapshot: () => PickerDirectorySnapshot;
}
/** Cohesive picker operations shared by composer, Plan Review, and plugin adapters. */
export interface PickerDirectoryOperations {
    getDirectorySnapshot: () => PickerDirectorySnapshot;
    load: () => void;
    select: (selection: ModelSelection) => Promise<boolean>;
}
export interface PickerDirectoryFace extends PickerDirectoryOperations {
    hooks: {
        directory: PickerDirectoryStore;
    };
}
