import type { ModelSelection } from '@deepseek-ai/dsh-api-remotes/client'

export interface PlanReviewOption {
  label: string
  description?: string
}

export interface PlanReview {
  id: string
  question: string
  plan: string
  approve: PlanReviewOption
  decline?: PlanReviewOption
}

interface QuestionItem {
  id: string
  question: string
  detail?: string
  multiSelect?: boolean
  options?: readonly PlanReviewOption[]
  intent?: { kind: string; approve?: string }
}

interface QuestionWaitLike {
  kind: string
  key: string
  questions?: readonly QuestionItem[]
  payload?: { questions: readonly QuestionItem[] }
  // alpha.1 PendingQuestion has questions directly; rc.2 PendingWait has payload.questions
  [key: string]: unknown
}

interface ComposerOwner {
  /** alpha.1: the single effective interaction, undefined when none. */
  pendingInteraction?: { kind: string; payload?: unknown } | undefined
  /** rc.2: the pending-interaction array. Kept as a fallback. */
  interactions?: readonly { kind: string; payload?: unknown }[]
}

export function planReviewOf(questions: readonly QuestionItem[]): PlanReview | undefined {
  if (questions.length !== 1) return undefined
  const question = questions[0]
  if (question === undefined) return undefined
  const intent = question.intent
  if (intent?.kind !== 'plan-review' || question.detail === undefined || question.multiSelect === true) return undefined
  const options = question.options ?? []
  if (options.length > 2) return undefined
  const approve = options.find(option => option.label === intent.approve)
  if (approve === undefined) return undefined
  const decline = options.find(option => option.label !== intent.approve)
  return {
    id: question.id,
    question: question.question,
    plan: question.detail,
    approve,
    ...(decline === undefined ? {} : { decline }),
  }
}

function isQuestionWait(value: { kind: string; payload?: unknown; questions?: unknown }): value is QuestionWaitLike {
  if (value.kind !== 'question' && value.kind !== 'plan-review') return false
  // alpha.1 PendingQuestion: questions directly; rc.2 PendingWait: payload.questions
  if (Array.isArray((value as { questions?: unknown }).questions)) return true
  if (value.payload === undefined || typeof value.payload !== 'object' || value.payload === null) return false
  return Array.isArray((value.payload as { questions?: unknown }).questions)
}

function questionsOf(wait: QuestionWaitLike): readonly QuestionItem[] {
  if (Array.isArray(wait.questions)) return wait.questions as readonly QuestionItem[]
  if (wait.payload !== undefined && typeof wait.payload === 'object' && wait.payload !== null) {
    const qs = (wait.payload as { questions?: unknown }).questions
    if (Array.isArray(qs)) return qs as readonly QuestionItem[]
  }
  return []
}

export function selectPlanReview(owner: ComposerOwner): QuestionWaitLike | null {
  // alpha.1 replaced the pending-interaction array with one effective value.
  const candidates = owner.pendingInteraction !== undefined
    ? [owner.pendingInteraction]
    : owner.interactions ?? []
  const wait = candidates.find(isQuestionWait)
  if (wait === undefined) return null
  return planReviewOf(questionsOf(wait)) === undefined ? null : wait
}

export class PlanApprovalResponseError extends Error {}

export async function approvePlanReview(args: {
  select: (selection: ModelSelection) => Promise<boolean>
  selection: ModelSelection
  answer: () => Promise<void>
}): Promise<boolean> {
  if (!await args.select(args.selection)) return false
  await args.answer()
  return true
}

export interface PlanActionState {
  busy: boolean
  blocked: boolean
  error: string | null
}

export interface PlanActionView {
  approveDisabled: boolean
  error: string | null
}

export function planActionView(
  state: PlanActionState,
  available: boolean,
  hasExecution: boolean,
): PlanActionView {
  return {
    approveDisabled: state.busy || state.blocked || !available || !hasExecution,
    error: state.error,
  }
}

export async function settlePlanAction(
  send: () => Promise<void>,
  update: (state: PlanActionState) => void,
): Promise<boolean> {
  update({ busy: true, blocked: false, error: null })
  try {
    await send()
    return true
  } catch (cause: unknown) {
    update({
      busy: false,
      blocked: cause instanceof PlanApprovalResponseError,
      error: cause instanceof Error ? cause.message : String(cause),
    })
    return false
  }
}
