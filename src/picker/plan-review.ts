import type { ModelSelection } from '@deepseek-ai/dsh-api-session-controller/types'
import type { ComposerChainProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PendingQuestion, PlanReview } from '@deepseek-ai/dsh-client-ui-user-questions/client'

export type { PlanReview } from '@deepseek-ai/dsh-client-ui-user-questions/client'
export type PlanReviewOption = PlanReview['approve']

type QuestionItem = PendingQuestion['questions'][number]

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

export function selectPlanReview(owner: ComposerChainProps): PendingQuestion | null {
  const interaction = owner.pendingInteraction
  if (interaction === undefined || (interaction.kind !== 'question' && interaction.kind !== 'plan-review')) return null
  return planReviewOf(interaction.questions) === undefined ? null : interaction
}

export class PlanApprovalResponseError extends Error {}

export async function approvePlanReview(args: {
  select: (selection: ModelSelection) => Promise<boolean>
  selection: ModelSelection
  current?: ModelSelection | null
  answer: () => Promise<void>
}): Promise<boolean> {
  const current = args.current
  const same = current !== undefined && current !== null
    && current.provider === args.selection.provider
    && current.model === args.selection.model
    && current.reasoningEffort === args.selection.reasoningEffort
  if (!same && !await args.select(args.selection)) return false
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
