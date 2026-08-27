/**
 * Composer model seat: suffix-grouped Model / Effort / Context / Fast / Thinking.
 */
import type { ModelSelection } from '@deepseek-ai/dsh-api-remotes/client';
import type { PickerKey } from './locales.ts';
import type { PickerDirectoryOperations, PickerDirectorySnapshot } from './PickerDirectory.ts';
import type { PickerInteractionOperations } from './popup-dismissal.ts';
export type { PickerDirectoryFace, PickerDirectoryOperations, PickerDirectorySnapshot } from './PickerDirectory.ts';
export type ExternalAgentAdapterId = 'codex' | 'claude-code' | 'cursor' | 'antigravity';
export type ExternalPlanTargetId = `external-agent:${ExternalAgentAdapterId}`;
export type PlanTargetId = 'dsh' | ExternalPlanTargetId;
export interface ComposerPickerExternalTarget {
    id: ExternalPlanTargetId;
    label: string;
    description?: string;
    disabled?: boolean;
}
interface ComposerPickerBaseProps {
    locked: boolean;
    available: boolean;
    directory: PickerDirectorySnapshot;
    directoryFace: PickerDirectoryOperations;
    t: (key: PickerKey, params?: Record<string, string>) => string;
    embedded?: boolean;
    tone?: 'capsule';
    externalTargets?: readonly ComposerPickerExternalTarget[];
    externalTargetsLabel?: string;
    externalSelection?: ExternalPlanTargetId;
    onExternalTargetChange?: (id: ExternalPlanTargetId | undefined) => void;
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
export declare function ComposerPicker({ locked, available, directory: state, directoryFace, t, draft, onDraftChange, embedded, tone, externalTargets, externalTargetsLabel, externalSelection, onExternalTargetChange, resolveInteractionOperations, }: ComposerPickerProps): import("react").JSX.Element | null;
