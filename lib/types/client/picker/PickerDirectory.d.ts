import type { ModelSelection } from '@deepseek-ai/dsh-api-remotes/client';
import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client';
export type PickerDirectorySnapshot = Pick<ModelDirectoryState, 'current' | 'routable' | 'groups' | 'failures' | 'status' | 'error'>;
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
/** The exact state and operations one picker render consumes. */
export interface PickerDirectoryView extends PickerDirectoryOperations {
    snapshot: PickerDirectorySnapshot;
}
export interface PickerDirectoryFace extends PickerDirectoryOperations {
    hooks: {
        directory: PickerDirectoryStore;
    };
}
export declare function pickerDirectoryView(snapshot: PickerDirectorySnapshot, operations: PickerDirectoryOperations): PickerDirectoryView;
