import type { ModelSelection } from '@deepseek-ai/dsh-api-session-controller/types';
import type { ComposerChainProps } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { PendingQuestion, PlanReview } from '@deepseek-ai/dsh-client-ui-user-questions/client';
export type { PlanReview } from '@deepseek-ai/dsh-client-ui-user-questions/client';
export type PlanReviewOption = PlanReview['approve'];
type QuestionItem = PendingQuestion['questions'][number];
export declare function planReviewOf(questions: readonly QuestionItem[]): PlanReview | undefined;
export declare function selectPlanReview(owner: ComposerChainProps): PendingQuestion | null;
export declare class PlanApprovalResponseError extends Error {
}
export declare function approvePlanReview(args: {
    select: (selection: ModelSelection) => Promise<boolean>;
    selection: ModelSelection;
    answer: () => Promise<void>;
}): Promise<boolean>;
export interface PlanActionState {
    busy: boolean;
    blocked: boolean;
    error: string | null;
}
export interface PlanActionView {
    approveDisabled: boolean;
    error: string | null;
}
export declare function planActionView(state: PlanActionState, available: boolean, hasExecution: boolean): PlanActionView;
export declare function settlePlanAction(send: () => Promise<void>, update: (state: PlanActionState) => void): Promise<boolean>;
