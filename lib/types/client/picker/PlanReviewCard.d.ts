import type { PendingWait } from './shim.js';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { type PickerDirectoryFace } from './PickerDirectory.ts';
import type { PickerInteractionOperations } from './popup-dismissal.ts';
type QuestionWait = PendingWait<'question'>;
export interface PlanReviewFace extends PickerDirectoryFace {
    available: boolean;
    resolveInteractionOperations?: () => PickerInteractionOperations | undefined;
}
export type PlanReviewCardProps = PropsRuntime<'conversation.composer'> & PropsLocale<'composer-picker'> & InjectFace<PlanReviewFace> & {
    matched: QuestionWait;
};
export declare function PlanReviewCard(props: PlanReviewCardProps): import("react").JSX.Element;
export {};
