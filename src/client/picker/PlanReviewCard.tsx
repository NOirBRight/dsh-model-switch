import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { ModelSelection } from '@deepseek-ai/dsh-api-session-controller/types'
import type { PendingQuestion, PlanReview } from '@deepseek-ai/dsh-client-ui-user-questions/client'
import type { ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { MainSettingsView } from '../../client-contract.ts'
import { Button, IconEditOutlineRegular, MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  PlanApprovalResponseError, approvePlanReview, planActionView, planReviewOf, settlePlanAction,
} from '../../picker/plan-review.ts'
import { ComposerPicker } from './ComposerPicker.tsx'
import { pickerDirectoryViewOrdered, type PickerDirectoryFace, type PickerDirectoryView } from './PickerDirectory.ts'
import type { PickerInteractionOperations } from './popup-dismissal.ts'
import { RetryBoundary } from './RetryBoundary.tsx'
import { agentProviderLocked, effectiveProviderLock, runtimeChoiceAllowed, type RuntimeProviderLock } from '../runtime-lock.ts'
import { isAgentRole } from '../antigravity-catalog.ts'
import css from './PlanReviewCard.module.css'

interface PickerGuardProps {
  children: ReactNode
  errorLabel: (message: string) => string
  retryLabel: string
}

function PickerGuard({ children, errorLabel, retryLabel }: PickerGuardProps) {
  return (
    <RetryBoundary
      logLabel="dsh-model-switch: Plan Review picker crashed"
      renderFallback={(message, retry) => (
        <div data-dsh-ms-plan-picker-error role="alert" className={css.pickerError}>
          <span>{errorLabel(message)}</span>
          <Button type="button" variant="outline" onClick={retry}>{retryLabel}</Button>
        </div>
      )}
    >
      {children}
    </RetryBoundary>
  )
}

export interface PlanReviewFace extends PickerDirectoryFace {
  available: boolean
  resolveInteractionOperations?: () => PickerInteractionOperations | undefined
  /** Resolve a provider key to its ProviderDirectory role for runtime icons. */
  roleOf?: (providerKey: string) => string | undefined
  /** Shared native-binding lock state for the seat session. */
  providerLockStore: { subscribe: (listener: () => void) => () => void; getSnapshot: () => { provider: RuntimeProviderLock; failed: boolean } }
  /** Re-read the native binding now (mount, turn transitions, pre-selection). */
  refreshProviderLock: () => void
  subscribeMainDefaults: (listener: () => void) => () => void
  getMainDefaultsSnapshot: () => ConfigFormSnapshot<MainSettingsView>
  /** Live catalog-group-id → card-key map from ProviderDirectory. */
  catalogRoutes?: () => Readonly<Record<string, string>>
}

export type PlanReviewCardProps = PropsRuntime<'conversation.composer'>
  & PropsLocale<'composer-picker'>
  & InjectFace<PlanReviewFace>
  & { matched: PendingQuestion }

async function respondAnswer(
  wait: PendingQuestion,
  id: string,
  label: string,
  rejectedMessage: string,
  terminalRejection = false,
): Promise<void> {
  try {
    await wait.answer({ answers: [{ id, selected: [label] }] })
  } catch {
    const ErrorType = terminalRejection ? PlanApprovalResponseError : Error
    throw new ErrorType(rejectedMessage)
  }
}

async function respondCancel(wait: PendingQuestion, rejectedMessage: string): Promise<void> {
  try {
    await wait.cancel()
  } catch {
    throw new Error(rejectedMessage)
  }
}

interface PlanReviewStateProps {
  matched: PendingQuestion
  review: PlanReview
  available: boolean
  providerLock: RuntimeProviderLock
  agentLocked: boolean
  lockFailed: boolean
  settingsUnavailableReason?: string
  directory: PickerDirectoryView
  t: PlanReviewCardProps['t']
  resolveInteractionOperations?: () => PickerInteractionOperations | undefined
  /** Resolve a provider key to its ProviderDirectory role for runtime icons. */
  roleOf?: (providerKey: string) => string | undefined
}

/** Match the model seat's admission guard before letting either picker offer a change. */
export function mainDefaultsUnavailableReason(
  snapshot: ConfigFormSnapshot<MainSettingsView>,
  t: PlanReviewCardProps['t'],
): string | undefined {
  if (snapshot.mode === 'memory') return t('settings.remoteUnavailable')
  if (snapshot.status === 'loading') return t('settings.loading')
  if (snapshot.status !== 'ready' || snapshot.mode !== 'host' || !snapshot.writable
    || snapshot.value === undefined || snapshot.revision === undefined) return t('settings.unavailable')
  return undefined
}

/** Inline failed lock-read status; history and log reading stay unaffected. */
export function ProviderLockHint(props: { t: PlanReviewCardProps['t'] }) {
  return (
    <div role="alert" className={css.strip} data-provider-lock-failed>
      <span className={css.dot} />
      <span className={css.stripTitle}>{props.t('lock.readFailed')}</span>
    </div>
  )
}

export function PlanReviewCard(props: PlanReviewCardProps) {
  const snapshot = props.useDirectory(value => value)
  const order = props.useProviderOrder(value => value)
  const settingsUnavailableReason = mainDefaultsUnavailableReason(
    useSyncExternalStore(props.subscribeMainDefaults, props.getMainDefaultsSnapshot), props.t,
  )
  const lock = useSyncExternalStore(props.providerLockStore.subscribe, props.providerLockStore.getSnapshot)
  const phase = props.useInput(input => input.phase)
  const blank = props.useSession(session => session.blank)
  const active = props.useSession(session => session.running || session.awaitingFirstTurn) || phase === 'submitting'
  useEffect(() => { props.refreshProviderLock() }, [props.refreshProviderLock, phase, active, snapshot, order])
  const providerLock = effectiveProviderLock(lock, snapshot.current?.provider, active, isAgentRole(props.roleOf?.(snapshot.current?.provider ?? '')))
  const agentLocked = agentProviderLocked(blank, providerLock, active)
  const review = planReviewOf(props.matched.questions)
  if (review === undefined) {
    return (
      <div className={css.frame} data-plan-review-key={props.matched.key}>
        <section className={css.card} aria-label={props.t('plan.header')}>
          <div className={css.strip}><span className={css.dot} />{props.t('plan.header')}</div>
          {lock.failed && <ProviderLockHint t={props.t} />}
        </section>
      </div>
    )
  }
  return <PlanReviewState
    key={props.matched.key}
    matched={props.matched}
    review={review}
    available={props.available && (!lock.failed || snapshot.current !== null)}
    providerLock={providerLock}
    agentLocked={agentLocked}
    lockFailed={lock.failed}
    {...(settingsUnavailableReason === undefined ? {} : { settingsUnavailableReason })}
    directory={pickerDirectoryViewOrdered(snapshot, props, order, props.catalogRoutes?.() ?? {})}
    t={props.t}
    {...props.resolveInteractionOperations === undefined ? {} : { resolveInteractionOperations: props.resolveInteractionOperations }}
    {...props.roleOf === undefined ? {} : { roleOf: props.roleOf }}
  />
}

function PlanReviewState({
  matched, review, available, providerLock, agentLocked, lockFailed, settingsUnavailableReason, directory, t, resolveInteractionOperations, roleOf,
}: PlanReviewStateProps) {
  const { snapshot, getDirectorySnapshot, load, select } = directory
  const [execution, setExecution] = useState<ModelSelection | undefined>(snapshot.current ?? undefined)
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const operationLocked = useRef(false)

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (execution === undefined && snapshot.current !== null) setExecution(snapshot.current)
  }, [execution, snapshot.current])

  const settle = (send: () => Promise<void>): void => {
    if (operationLocked.current || blocked) return
    operationLocked.current = true
    let terminal = false
    void settlePlanAction(send, (state) => {
      terminal = state.blocked
      setBusy(state.busy)
      setBlocked(state.blocked)
      setError(state.error)
    }).then((completed) => {
      if (!completed && !terminal) operationLocked.current = false
    })
  }

  const settingsBlock = settingsUnavailableReason !== undefined && execution !== undefined
    && (snapshot.current === null || execution.provider !== snapshot.current.provider
      || execution.model !== snapshot.current.model
      || execution.reasoningEffort !== snapshot.current.reasoningEffort)
  const executionAllowed = execution !== undefined && !settingsBlock
    && runtimeChoiceAllowed(
      providerLock,
      agentLocked,
      execution.provider,
      snapshot.current?.provider,
      isAgentRole(roleOf?.(execution.provider)),
    )
  const action = planActionView({ busy, blocked, error }, available, executionAllowed)

  const onApprove = (): void => {
    if (execution === undefined || !executionAllowed || !available || busy || blocked) return
    settle(async () => {
      const committed = await approvePlanReview({
        select,
        selection: execution,
        current: snapshot.current,
        answer: () => respondAnswer(matched, review.id, review.approve.label, t('plan.responseRejected'), true),
      })
      if (!committed) {
        const message = getDirectorySnapshot().error
        throw new Error(message === null ? t('plan.modelFailed') : t('error.action', { message }))
      }
    })
  }

  return (
    <div className={css.frame} data-plan-review-key={matched.key}>
      <section className={css.card} aria-label={review.question}>
        {lockFailed && <ProviderLockHint t={t} />}
        <div className={css.strip}>
          <span className={css.dot} />
          <span className={css.stripTitle}>{t('plan.header')}</span>
          <div
            className={css.headerPicker}
            aria-label={t('plan.execution')}
            onPointerDown={event => { event.stopPropagation() }}
          >
            <PickerGuard
              errorLabel={message => t('plan.pickerCrash', { message })}
              retryLabel={t('retry')}
            >
            <ComposerPicker
              locked={busy || blocked || settingsUnavailableReason !== undefined}
              providerLock={providerLock}
              agentLocked={agentLocked}
              {...(roleOf === undefined ? {} : { roleOf })}
              available={available}
              {...(settingsUnavailableReason === undefined ? {} : { unavailableReason: settingsUnavailableReason })}
              directory={directory}
              t={t}
              {...resolveInteractionOperations === undefined ? {} : { resolveInteractionOperations }}
              {...execution === undefined ? {} : { draft: execution }}
              onDraftChange={setExecution}
              embedded
              tone="capsule"
            />
            </PickerGuard>
          </div>
        </div>
        <div className={css.body} data-plan-review-scroll>
          <MarkdownText text={review.plan} labels={{ code: { copyLabel: t('markdown.copy'), copiedLabel: t('markdown.copied') }, footnotes: t('markdown.footnotes') }} />
        </div>
        <div className={css.footer}>
          <div className={css.feedback} role="status">{action.error ?? (settingsBlock ? settingsUnavailableReason : null)}</div>
          <div className={css.bar}>
            <div className={css.actions}>
              <Button
                variant="ghost"
                className={css.discuss}
                icon={<IconEditOutlineRegular size={14} />}
                disabled={busy || blocked}
                onClick={() => {
                  settle(() => respondCancel(matched, t('plan.cancelRejected')))
                }}
              >
                {t('plan.discuss')}
              </Button>
              {review.decline !== undefined && (
                <Button
                  variant="outline"
                  className={css.keep}
                  disabled={busy || blocked}
                  title={review.decline.description ?? t('plan.keep')}
                  onClick={() => {
                    settle(() => respondAnswer(matched, review.id, review.decline!.label, t('plan.responseRejected')))
                  }}
                >
                  {t('plan.keep')}
                </Button>
              )}
              <Button variant="primary" className={css.approve} disabled={action.approveDisabled} onClick={onApprove}>
                {t('plan.approve')}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
