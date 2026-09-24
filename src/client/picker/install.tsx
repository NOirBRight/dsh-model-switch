/**
 * Composer model seat + Plan Review execution picker.
 */

import type { ModelSelection } from '@deepseek-ai/dsh-api-session-controller/types'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ComposerChainProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { useEffect, useSyncExternalStore } from 'react'
import { MAIN_DEFAULT_CONFIG_ID, PROVIDERS_CONFIG_ID, type MainSettingsView } from '../../client-contract.ts'
import { selectPlanReview } from '../../picker/plan-review.ts'
import { ComposerPicker } from './ComposerPicker.tsx'
import type { ProviderOrderSettings } from 'dsh-llm-providers-ui/order'
import { pickerDirectoryViewOrdered, type PickerDirectoryFace } from './PickerDirectory.ts'
import type { PickerInteractionOperations } from './popup-dismissal.ts'
import { PlanReviewCard, ProviderLockHint } from './PlanReviewCard.tsx'
import { PickerSeatBoundary } from './PickerSeatBoundary.tsx'
import {
  agentProviderLocked,
  createProviderLockStore,
  effectiveProviderLock,
  fetchSessionBinding,
  isProviderAllowed,
  type ProviderLockState,
  type ProviderLockStore,
} from '../runtime-lock.ts'
import { isAgentRole, readProviderRole } from '../antigravity-catalog.ts'
import { readCatalogRoutes, readNativeBindings, type ProviderDirectoryFace } from '../provider-directory.ts'
import { en, zh, type PickerKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'composer-picker': PickerKey
  }
}

const NS = 'composer-picker'
const MODEL_PRIORITY = -10
const PLAN_REVIEW_PRIORITY = -5

function interactionOperationsFrom(ctx: ClientContext): PickerInteractionOperations | undefined {
  let value: unknown
  try {
    value = ctx.get('interactionOperations', false)
  } catch {
    return undefined
  }
  if (value === null || typeof value !== 'object') return undefined
  const candidate = value as Partial<PickerInteractionOperations>
  return typeof candidate.registerSurface === 'function' ? candidate as PickerInteractionOperations : undefined
}

const EMPTY_ORDER: readonly string[] = []

/**
 * Bind the optional Providers entry order as a React external store.
 * @returns A subscribable order snapshot with an invalidation hook for directory changes.
 */
export function providerOrderStore(form: ConfigForm<ProviderOrderSettings>) {
  const listeners = new Set<() => void>()
  let last: readonly string[] = EMPTY_ORDER
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      const stop = form.subscribe(listener)
      return () => { listeners.delete(listener); stop() }
    },
    getSnapshot: () => {
      const next = form.getSnapshot().value?.order ?? EMPTY_ORDER
      if (next.length !== last.length || next.some((key, index) => key !== last[index])) last = [...next]
      return last
    },
    invalidate: () => {
      last = [...last]
      for (const listener of listeners) listener()
    },
  }
}

interface DirectoryFace extends PickerDirectoryFace {
  available: boolean
  resolveInteractionOperations?: () => PickerInteractionOperations | undefined
  /** Shared native-binding lock state for the seat session. */
  providerLockStore: ProviderLockStore
  /** Re-read the native binding now (mount, turn transitions, pre-selection). */
  refreshProviderLock: () => void
  /** Resolve a provider key to its ProviderDirectory role for runtime icons. */
  roleOf?: (key: string) => string | undefined
  /** Live catalog-group-id → card-key map from ProviderDirectory. */
  catalogRoutes?: () => Readonly<Record<string, string>>
}

function mainDefaultOps(selection: MainSettingsView) {
  return [
    { op: 'set' as const, path: ['provider'], value: selection.provider },
    { op: 'set' as const, path: ['model'], value: selection.model },
    selection.reasoningEffort === undefined || selection.reasoningEffort === ''
      ? { op: 'unset' as const, path: ['reasoningEffort'] }
      : { op: 'set' as const, path: ['reasoningEffort'], value: selection.reasoningEffort },
  ]
}

async function restoreMainDefault(
  mainDefaults: ConfigForm<MainSettingsView>,
  before: ConfigFormSnapshot<MainSettingsView>,
): Promise<void> {
  if (before.status !== 'ready' || before.mode !== 'host' || !before.writable
    || before.value === undefined || before.revision === undefined) return
  const expectedRevision = before.revision + 1
  const accepted = await mainDefaults.mutate(
    mainDefaultOps(before.value),
    // session.selectModel performs exactly one complete-section default write
    // before its RPC resolves. Fence the compensation so a concurrent edit wins.
    expectedRevision,
  )
  if (!accepted && mainDefaults.getSnapshot().revision === expectedRevision) throw new Error('settings-rejected')
}

function readSessionState(sessions: unknown, sessionId: unknown): { blank?: boolean; active: boolean } | undefined {
  if (sessions === null || typeof sessions !== 'object') return undefined
  const get = (sessions as { get?: (id: unknown) => { getSnapshot?: () => { blank?: boolean; running?: boolean; awaitingFirstTurn?: boolean; pendingSubmissions?: readonly unknown[] } } }).get
  if (typeof get !== 'function') return undefined
  try {
    const snapshot = get.call(sessions, sessionId)?.getSnapshot?.()
    if (snapshot === undefined) return undefined
    return {
      ...(typeof snapshot.blank === 'boolean' ? { blank: snapshot.blank } : {}),
      active: snapshot.running === true || snapshot.awaitingFirstTurn === true || (snapshot.pendingSubmissions?.length ?? 0) > 0,
    }
  } catch {
    // Public Session snapshot threw; fail closed so Agent conversion cannot proceed.
    return { blank: false, active: true }
  }
}

function ModelSeat(
  props: PropsRuntime<'conversation.input.model'> & PropsLocale<'composer-picker'> & InjectFace<DirectoryFace>,
) {
  const directory = props.useDirectory(snapshot => snapshot)
  const order = props.useProviderOrder(value => value)
  const lock = useSyncExternalStore(props.providerLockStore.subscribe, props.providerLockStore.getSnapshot)
  const phase = props.useInput(input => input.phase)
  const blank = props.useSession(session => session.blank)
  const active = props.useSession(session => session.running || session.awaitingFirstTurn) || phase === 'submitting'
  useEffect(() => { props.refreshProviderLock() }, [props.refreshProviderLock, phase, active, directory, order])
  const providerLock = effectiveProviderLock(lock, directory.current?.provider, active, isAgentRole(props.roleOf?.(directory.current?.provider ?? '')))
  return (
    <>
    {lock.failed && <ProviderLockHint t={props.t} />}
    <ComposerPicker
      locked={props.locked || (lock.failed && directory.current === null)}
      providerLock={providerLock}
      agentLocked={agentProviderLocked(blank, providerLock, active)}
      {...(props.roleOf === undefined ? {} : { roleOf: props.roleOf })}
      available={props.available}
      directory={pickerDirectoryViewOrdered(directory, props, order, props.catalogRoutes?.() ?? {})}
      t={props.t}
      {...props.resolveInteractionOperations === undefined
        ? {}
        : { resolveInteractionOperations: props.resolveInteractionOperations }}
    />
    </>
  )
}

function ModelSeatEntry(props: Parameters<typeof ModelSeat>[0]) {
  return (
    <PickerSeatBoundary errorLabel={message => props.t('error.picker', { message })}>
      <ModelSeat {...props} />
    </PickerSeatBoundary>
  )
}

/** Register composer model picker and Plan Review execution picker. */
export function installComposerPicker(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-model-switch: composer picker dictionaries')

  ctx.inject(['slots', 'modelDirectories', 'configForms'], (scope: ClientContext) => {
    const models = scope.modelDirectories
    const sessions = scope.sessions as {
      subagentAddress?: (id: unknown) => unknown
      get?: (id: unknown) => { getSnapshot?: () => { blank?: boolean } }
    } | undefined
    const mainDefaults = scope.configForms.get<MainSettingsView>(MAIN_DEFAULT_CONFIG_ID)
    let directoryService: ProviderDirectoryFace | undefined
    const orderStore = providerOrderStore(scope.configForms.get<ProviderOrderSettings>(PROVIDERS_CONFIG_ID))
    scope.inject(['providerDirectory'], directoryScope => {
      const directory = directoryScope.get('providerDirectory', false) as ProviderDirectoryFace | undefined
      if (directory === undefined || typeof directory.subscribe !== 'function') return
      directoryService = directory
      orderStore.invalidate()
      directoryScope.effect(() => directory.subscribe(orderStore.invalidate))
      directoryScope.effect(() => () => {
        if (directoryService === directory) directoryService = undefined
        orderStore.invalidate()
      })
    })
    const resolveInteractionOperations = (): PickerInteractionOperations | undefined => interactionOperationsFrom(scope)
    type SessionRpc = Parameters<typeof fetchSessionBinding>[0]
    const rpcOf = (): SessionRpc => {
      const connection = scope.get('connection', false) as { rpc?: SessionRpc } | undefined
      return connection?.rpc
    }
    const directoryFace = (sessionId: Parameters<typeof models.directoryFor>[0]): DirectoryFace => {
      const directory = models.directoryFor(sessionId)
      const available = sessions?.subagentAddress?.(sessionId) === undefined
      const readLock = async (previous: ProviderLockState): Promise<ProviderLockState> => {
        const result = await fetchSessionBinding(rpcOf(), sessionId, readNativeBindings(directoryService))
        return result.failed ? { provider: result.provider ?? previous.provider, failed: true } : result
      }
      const roleOf = (key: string): string | undefined => readProviderRole(directoryService, key)
      const providerLockStore = createProviderLockStore(readLock)
      return {
        available,
        roleOf,
        catalogRoutes: () => readCatalogRoutes(directoryService),
        providerLockStore,
        refreshProviderLock: () => {
          void providerLockStore.refresh()
        },
        hooks: { directory: directory.store, providerOrder: orderStore },
        getDirectorySnapshot: directory.store.getSnapshot,
        resolveInteractionOperations,
        load: () => {
          if (available) directory.load().catch(() => { /* surfaced on the store */ })
        },
        select: async (selection: ModelSelection) => {
          if (!available) return false
          const state = await providerLockStore.refresh()
          const currentProvider = directory.store.getSnapshot().current?.provider
          if (!isProviderAllowed(state, selection.provider, currentProvider, {
            ...readSessionState(sessions, sessionId),
            agent: isAgentRole(roleOf(selection.provider)),
            currentAgent: currentProvider !== undefined && isAgentRole(roleOf(currentProvider)),
          })) return false
          const defaultBeforeSwitch = mainDefaults.getSnapshot()
          try {
            await directory.select(selection)
            await restoreMainDefault(mainDefaults, defaultBeforeSwitch)
            return true
          } catch {
            return false
          }
        },
      }
    }

    scope.slots.inject('conversation.input.model', () => scope.slots.register({
      name: 'conversation.input.model',
      locale: NS,
      priority: MODEL_PRIORITY,
      inject: directoryFace,
    }, ModelSeatEntry))

    scope.slots.inject('conversation.composer', () => scope.slots.register({
      name: 'conversation.composer',
      locale: NS,
      priority: PLAN_REVIEW_PRIORITY,
      select: (owner: ComposerChainProps) => selectPlanReview(owner),
      inject: directoryFace,
    }, PlanReviewCard))
  })
}
