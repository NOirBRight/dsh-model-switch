/**
 * Composer model seat: suffix-grouped Model / Effort / Context / Fast / Thinking.
 */
import type { ModelSelection } from '@deepseek-ai/dsh-api-remotes/client';
import type { CatalogGroupView } from '../../picker/family.ts';
import type { PickerKey } from './locales.ts';
import { type PickerInteractionOperations } from './popup-dismissal.ts';
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
export type ExternalAgentAdapterId = 'codex' | 'claude-code' | 'cursor' | 'antigravity';
export type ExternalPlanTargetId = `external-agent:${ExternalAgentAdapterId}`;
export type PlanTargetId = 'dsh' | ExternalPlanTargetId;
export interface ComposerPickerExternalTarget {
    id: ExternalPlanTargetId;
    label: string;
    description?: string;
    disabled?: boolean;
}
export interface PickerDirectoryFace {
    hooks: {
        directory: PickerDirectoryStore;
    };
    getDirectorySnapshot: () => PickerDirectorySnapshot;
    load: () => void;
    select: (selection: ModelSelection) => Promise<boolean>;
}
interface ComposerPickerBaseProps {
    locked: boolean;
    available: boolean;
    directory: PickerDirectorySnapshot;
    getDirectorySnapshot: () => PickerDirectorySnapshot;
    load: () => void;
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
    select: (selection: ModelSelection) => Promise<boolean>;
    draft?: never;
    onDraftChange?: never;
} | {
    select?: never;
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
export declare function ComposerPicker({ locked, available, directory: state, getDirectorySnapshot, load, select, t, draft, onDraftChange, embedded, tone, externalTargets, externalTargetsLabel, externalSelection, onExternalTargetChange, resolveInteractionOperations, }: ComposerPickerProps): import("react").JSX.Element | null;
export {};
