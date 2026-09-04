/**
 * Composer model seat + Plan Review execution picker.
 */

import type { ModelSelection } from '@deepseek-ai/dsh-api-session-controller/types'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ComposerChainProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { decodeMainSettings, MAIN_SETTINGS_ID, type MainSettingsView } from '../../client-contract.ts'
import { selectPlanReview } from '../../picker/plan-review.ts'
import { ComposerPicker } from './ComposerPicker.tsx'
import { decodeProviderOrder, PROVIDERS_SETTINGS_NS } from 'dsh-llm-providers-ui/order'
import { pickerDirectoryViewOrdered, type PickerDirectoryFace, type PickerDirectorySnapshot } from './PickerDirectory.ts'
import { createExternalCatalogStore } from './external-catalog.ts'
import type { PickerInteractionOperations } from './popup-dismissal.ts'
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
const PLAN_REVIEW_PRIORITY = -5

function externalCatalogLoader(ctx: ClientContext): (() => Promise<PickerDirectorySnapshot['groups']>) | undefined {
  let value: unknown
  try { value = ctx.get('connection', false) } catch { return undefined }
  if (value === null || typeof value !== 'object' || !('rpc' in value)) return undefined
  const rpc = (value as { rpc: { call: (channel: string, endpoint: string, payload: unknown, extra: undefined) => Promise<{ ok: boolean; value?: { groups?: PickerDirectorySnapshot['groups'] } }> } }).rpc
  return async () => {
    try {
      const result = await rpc.call('/dsh-acp-antigravity', 'catalog', {}, undefined)
      return result.ok && Array.isArray(result.value?.groups) ? result.value.groups : []
    } catch { return [] }
  }
}

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

function providerOrderStore(settingsScope: { bind(options: { namespace: string, decode: (value: unknown) => { order: string[] } }): { getSnapshot(): { value?: { order: string[] } | undefined }, subscribe(listener: () => void): () => void } }) {
  let bound: ReturnType<typeof settingsScope.bind> | undefined
  try {
    bound = settingsScope.bind({ namespace: PROVIDERS_SETTINGS_NS, decode: decodeProviderOrder })
  } catch {
    bound = undefined
  }
  let last: readonly string[] = EMPTY_ORDER
  return {
    subscribe: (listener: () => void) => bound?.subscribe(listener) ?? (() => {}),
    getSnapshot: () => {
      const next = bound?.getSnapshot().value?.order ?? EMPTY_ORDER
      if (next.length === last.length && next.every((key, index) => key === last[index])) return last
      last = next
      return last
    },
  }
}

interface DirectoryFace extends PickerDirectoryFace {
  available: boolean
  resolveInteractionOperations?: () => PickerInteractionOperations | undefined
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

interface RemoteSettingsFace {
  mutate(ns: string, ops: readonly unknown[], expectedRevision: number | undefined): Promise<{
    ok: boolean
    value?: { revision: number }
    error?: { code: string; message: string }
  }>
}

async function restoreMainDefault(
  remoteSettings: RemoteSettingsFace,
  before: SettingsScopeSnapshot<MainSettingsView>,
): Promise<void> {
  if (before.status !== 'ready' || before.mode !== 'host' || !before.writable
    || before.value === undefined || before.revision === undefined) return
  const response = await remoteSettings.mutate(
    MAIN_SETTINGS_ID,
    mainDefaultOps(before.value),
    // session.selectModel performs exactly one complete-section default write
    // before its RPC resolves. Fence the compensating write so a concurrent
    // Settings-page edit wins instead of being overwritten.
    before.revision + 1,
  )
  if (!response.ok && response.error?.code !== 'settings-conflict') {
    throw new Error(`${response.error?.code}: ${response.error?.message}`)
  }
}

function ModelSeat(
  props: PropsRuntime<'conversation.input.model'> & PropsLocale<'composer-picker'> & InjectFace<DirectoryFace>,
) {
  const directory = props.useDirectory(snapshot => snapshot)
  const order = props.useProviderOrder(value => value)
  return (
    <ComposerPicker
      locked={props.locked}
      available={props.available}
      directory={pickerDirectoryViewOrdered(directory, props, order)}
      t={props.t}
      {...props.resolveInteractionOperations === undefined
        ? {}
        : { resolveInteractionOperations: props.resolveInteractionOperations }}
    />
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

  ctx.inject(['slots', 'modelDirectories', 'settingsScope', 'remote.settings'], (scope: ClientContext) => {
    const models = scope.modelDirectories
    const sessions = scope.sessions as { subagentAddress?: (id: unknown) => unknown } | undefined
    const mainDefaults = scope.settingsScope.bind({ namespace: MAIN_SETTINGS_ID, decode: decodeMainSettings })
    const orderStore = providerOrderStore(scope.settingsScope)
    const remoteSettings = (scope as unknown as { remote: { settings: RemoteSettingsFace } }).remote.settings
    const resolveInteractionOperations = (): PickerInteractionOperations | undefined => interactionOperationsFrom(scope)
    const loadExternalCatalog = externalCatalogLoader(scope)
    const directoryFace = (sessionId: Parameters<typeof models.directoryFor>[0]): DirectoryFace => {
      const directory = models.directoryFor(sessionId)
      const overlay = createExternalCatalogStore(directory.store)
      const available = sessions?.subagentAddress?.(sessionId) === undefined
      return {
        available,
        hooks: { directory: overlay.store, providerOrder: orderStore },
        getDirectorySnapshot: overlay.store.getSnapshot,
        resolveInteractionOperations,
        load: () => {
          if (available) directory.load().catch(() => { /* surfaced on the store */ })
          if (loadExternalCatalog !== undefined) void loadExternalCatalog().then(overlay.setExtra).catch(() => overlay.setExtra([]))
        },
        select: async (selection: ModelSelection) => {
          if (!available) return false
          if (overlay.extraIds().has(selection.provider)) {
            overlay.setCurrent(selection)
            return true
          }
          overlay.setCurrent(null)
          const defaultBeforeSwitch = mainDefaults.getSnapshot()
          try {
            await directory.select(selection)
            await restoreMainDefault(remoteSettings, defaultBeforeSwitch)
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
