import type { PendingQuestion } from '@deepseek-ai/dsh-client-ui-user-questions/client';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { type PickerDirectoryFace } from './PickerDirectory.ts';
import type { PickerInteractionOperations } from './popup-dismissal.ts';
import { type RuntimeProviderLock } from '../runtime-lock.ts';
export interface PlanReviewFace extends PickerDirectoryFace {
    available: boolean;
    resolveInteractionOperations?: () => PickerInteractionOperations | undefined;
    /** Resolve a provider key to its ProviderDirectory role for runtime icons. */
    roleOf?: (providerKey: string) => string | undefined;
    /** Shared native-binding lock state for the seat session. */
    providerLockStore: {
        subscribe: (listener: () => void) => () => void;
        getSnapshot: () => {
            provider: RuntimeProviderLock;
            failed: boolean;
        };
    };
    /** Re-read the native binding now (mount, turn transitions, pre-selection). */
    refreshProviderLock: () => void;
    /** Live catalog-group-id → card-key map from ProviderDirectory. */
    catalogRoutes?: () => Readonly<Record<string, string>>;
}
export type PlanReviewCardProps = PropsRuntime<'conversation.composer'> & PropsLocale<'composer-picker'> & InjectFace<PlanReviewFace> & {
    matched: PendingQuestion;
};
/** Inline failed lock-read status; history and log reading stay unaffected. */
export declare function ProviderLockHint(props: {
    t: PlanReviewCardProps['t'];
}): import("react").JSX.Element;
export declare function PlanReviewCard(props: PlanReviewCardProps): import("react").JSX.Element;
