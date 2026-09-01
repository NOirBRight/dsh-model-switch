/**
 * Composer model seat: suffix-grouped Model / Effort / Context / Fast / Thinking.
 */
import type { ModelSelection } from '@deepseek-ai/dsh-api-session-controller/types';
import type { PickerKey } from './locales.ts';
import type { PickerDirectoryView } from './PickerDirectory.ts';
import type { PickerInteractionOperations } from './popup-dismissal.ts';
export type { PickerDirectoryFace, PickerDirectoryOperations, PickerDirectorySnapshot, PickerDirectoryView } from './PickerDirectory.ts';
interface ComposerPickerBaseProps {
    locked: boolean;
    available: boolean;
    directory: PickerDirectoryView;
    t: (key: PickerKey, params?: Record<string, string>) => string;
    embedded?: boolean;
    tone?: 'capsule';
    resolveInteractionOperations?: () => PickerInteractionOperations | undefined;
}
export type ComposerPickerProps = ComposerPickerBaseProps & ({
    draft?: never;
    onDraftChange?: never;
} | {
    draft?: ModelSelection;
    onDraftChange: (selection: ModelSelection) => void;
});
export interface ModelPaneHeaderProps {
    title: string;
    backLabel: string;
    searchLabel: string;
    closeSearchLabel: string;
    searchable: boolean;
    searching: boolean;
    query: string;
    onBack: () => void;
    onStartSearch: () => void;
    onCloseSearch: () => void;
    onQueryChange: (query: string) => void;
}
export declare function ModelPaneHeader({ title, backLabel, searchLabel, closeSearchLabel, searchable, searching, query, onBack, onStartSearch, onCloseSearch, onQueryChange, }: ModelPaneHeaderProps): import("react").JSX.Element;
export declare function ComposerPicker({ locked, available, directory, t, draft, onDraftChange, embedded, tone, resolveInteractionOperations, }: ComposerPickerProps): import("react").JSX.Element | null;
