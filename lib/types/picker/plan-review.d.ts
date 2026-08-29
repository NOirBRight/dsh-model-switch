import type { ModelSelection } from '@deepseek-ai/dsh-api-remotes/client';
export interface PlanReviewOption {
    label: string;
    description?: string;
}
export interface PlanReview {
    id: string;
    question: string;
    plan: string;
    approve: PlanReviewOption;
    decline?: PlanReviewOption;
}
interface QuestionItem {
    id: string;
    question: string;
    detail?: string;
    multiSelect?: boolean;
    options?: readonly PlanReviewOption[];
    intent?: {
        kind: string;
        approve?: string;
    };
}
interface QuestionWaitLike {
    kind: string;
    key: string;
    questions?: readonly QuestionItem[];
    payload?: {
        questions: readonly QuestionItem[];
    };
    [key: string]: unknown;
}
interface ComposerOwner {
    /** alpha.1: the single effective interaction, undefined when none. */
    pendingInteraction?: {
        kind: string;
        payload?: unknown;
    } | undefined;
    /** rc.2: the pending-interaction array. Kept as a fallback. */
    interactions?: readonly {
        kind: string;
        payload?: unknown;
    }[];
}
export declare function planReviewOf(questions: readonly QuestionItem[]): PlanReview | undefined;
export declare function selectPlanReview(owner: ComposerOwner): QuestionWaitLike | null;
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
export {};
