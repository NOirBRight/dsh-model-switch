/**
 * Composer model seat + Plan Review execution picker.
 */

import type { ModelSelection } from '@deepseek-ai/dsh-api-remotes/client'
import type { ClientContext, PendingWait } from '@deepseek-ai/dsh-client-runtime/client'
import type { ComposerChainProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { selectPlanReview } from '../../picker/plan-review.ts'
import { ComposerPicker, type PickerDirectoryFace } from './ComposerPicker.tsx'
import type { PickerInteractionOperations } from './popup-dismissal.ts'
import { CONTINUE_IN_DSH_SLOT, ContinueInDshAdapter, type ContinueInDshFace } from './ContinueInDshAdapter.tsx'
export type { ContinueInDshOwner, PlanExternalAgentTarget } from './ContinueInDshAdapter.tsx'
import { PlanReviewCard } from './PlanReviewCard.tsx'
import { PickerSeatBoundary } from './PickerSeatBoundary.tsx'
import { en, zh, type PickerKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'composer-picker': PickerKey
  }
}

const NS = 'composer-picker'
const MODEL_PRIORITY = -10
// Beat dsh-external-agents (-6). Its Plan card is the execute-with router; until a
// public Plan-resolution seam exists that card cannot hand off, so this takeover owns review.
const PLAN_REVIEW_PRIORITY = -7

function interactionOperationsFrom(ctx: ClientContext): PickerInteractionOperations | undefined {
  const holder = ctx as ClientContext & {
    get?(name: string, strict?: boolean): unknown
    interactionOperations?: unknown
  }
  let value: unknown
  try {
    value = holder.get?.('interactionOperations', false) ?? holder.interactionOperations
  } catch {
    return undefined
  }
  if (value === null || typeof value !== 'object') return undefined
  const candidate = value as Partial<PickerInteractionOperations>
  return typeof candidate.registerSurface === 'function' ? candidate as PickerInteractionOperations : undefined
}

interface DirectoryFace extends PickerDirectoryFace {
  available: boolean
  resolveInteractionOperations?: () => PickerInteractionOperations | undefined
}

function ModelSeat(
  props: PropsRuntime<'conversation.input.model'> & PropsLocale<'composer-picker'> & InjectFace<DirectoryFace>,
) {
  const directory = props.useDirectory(snapshot => snapshot)
  return (
    <ComposerPicker
      locked={props.locked}
      available={props.available}
      directory={directory}
      getDirectorySnapshot={props.getDirectorySnapshot}
      load={props.load}
      select={props.select}
      t={props.t}
      {...props.resolveInteractionOperations === undefined
        ? {}
        : { resolveInteractionOperations: props.resolveInteractionOperations }}
    />
  )
}

function ModelSeatEntry(props: Parameters<typeof ModelSeat>[0]) {
  return <PickerSeatBoundary><ModelSeat {...props} /></PickerSeatBoundary>
}

/** Register composer model picker and Plan Review execution picker. */
export function installComposerPicker(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-model-switch: composer picker dictionaries')

  ctx.inject(['slots', 'modelDirectories'], (scope: ClientContext) => {
    const models = scope.modelDirectories
    const sessions = scope.sessions as { subagentAddress?: (id: unknown) => unknown } | undefined
    const resolveInteractionOperations = (): PickerInteractionOperations | undefined => interactionOperationsFrom(scope)
    const directoryFace = (sessionId: Parameters<typeof models.directoryFor>[0]): DirectoryFace => {
      const directory = models.directoryFor(sessionId)
      const available = sessions?.subagentAddress?.(sessionId) === undefined
      return {
        available,
        hooks: { directory: directory.store },
        getDirectorySnapshot: directory.store.getSnapshot,
        resolveInteractionOperations,
        load: () => {
          if (available) directory.load().catch(() => { /* surfaced on the store */ })
        },
        select: (selection: ModelSelection) => available
          ? directory.select(selection).then(() => true, () => false)
          : Promise.resolve(false),
      }
    }

    scope.slots.inject('conversation.input.model', () => scope.slots.register({
      name: 'conversation.input.model',
      locale: NS,
      priority: MODEL_PRIORITY,
      inject: directoryFace,
    }, ModelSeatEntry))

    scope.slots.inject(CONTINUE_IN_DSH_SLOT, () => scope.slots.register({
      name: CONTINUE_IN_DSH_SLOT,
      locale: NS,
      inject: (sessionId): ContinueInDshFace => directoryFace(sessionId),
    }, ContinueInDshAdapter))

    scope.slots.inject('conversation.composer', () => scope.slots.register({
      name: 'conversation.composer',
      locale: NS,
      priority: PLAN_REVIEW_PRIORITY,
      select: (owner: ComposerChainProps) => selectPlanReview(owner) as PendingWait<'question'> | null,
      inject: directoryFace,
    }, PlanReviewCard))
  })
}
