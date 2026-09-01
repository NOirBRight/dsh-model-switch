import { useEffect, useRef, useState } from 'react'
import type { ModelProviderGroup } from '@deepseek-ai/dsh-api-session-controller/types'
import type { SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import { MainSettingsConflictError, type CapabilityRouteView, type MainSettingsView, type SubagentSettingsView } from '../client-contract.js'
import type { ModelSwitchLocaleKey } from './locales.js'

type Share<T> = (selector: (snapshot: SettingsScopeSnapshot<T>) => SettingsScopeSnapshot<T>) => SettingsScopeSnapshot<T>
export interface SettingsControllerInputs {
  useMainSettings: Share<MainSettingsView>; useSubagentSettings: Share<SubagentSettingsView>
  saveMain(next: MainSettingsView, expectedRevision: number): Promise<number>
  loadCatalog(): Promise<readonly ModelProviderGroup[]>
  subscribeProviderOrder?: (listener: () => void) => () => void
  t(key: ModelSwitchLocaleKey): string
}
export interface Choice { id: string; name: string; unavailable?: true }
/** Build a settings route for a newly selected model using only that model's default effort. */
export function selectRouteModel(groups: readonly ModelProviderGroup[], provider: string, model: string): MainSettingsView {
  const defaultEffort = groups.find(group => group.id === provider)?.models.find(item => item.id === model)?.reasoning?.defaultEffort
  return { provider, model, ...(defaultEffort === undefined ? {} : { reasoningEffort: defaultEffort }) }
}
export function deriveRouteChoices(groups: readonly ModelProviderGroup[], route: CapabilityRouteView | undefined, allowedProviders?: readonly string[]): { providers: Choice[]; models: Choice[] } {
  const allowed = allowedProviders === undefined ? undefined : new Set(allowedProviders)
  const providers: Choice[] = groups.filter(group => allowed === undefined || allowed.has(group.id)).map(group => ({ id: group.id, name: group.name }))
  if (route?.provider !== undefined && !providers.some(option => option.id === route.provider)) providers.push({ id: route.provider, name: route.provider, unavailable: true })
  const group = groups.find(item => item.id === route?.provider)
  const models: Choice[] = (group?.models ?? []).map(model => ({ id: model.id, name: model.name }))
  if (route?.model !== undefined && !models.some(option => option.id === route.model)) models.push({ id: route.model, name: route.model, unavailable: true })
  return { providers, models }
}
export function expectedMainRevision(mirror: number, accepted?: number): number { return Math.max(mirror, accepted ?? mirror) }
export function acceptedRevisionAfterFailure(accepted: number | undefined, error: unknown): number | undefined { return error instanceof MainSettingsConflictError ? undefined : accepted }
export function deriveMainChoices(groups: readonly ModelProviderGroup[], draft?: MainSettingsView): { providers: Choice[]; models: Choice[]; efforts: Choice[] } {
  const providers = groups.map(group => ({ id: group.id, name: group.name }))
  if (draft !== undefined && !providers.some(option => option.id === draft.provider)) providers.push({ id: draft.provider, name: draft.provider })
  const group = groups.find(item => item.id === draft?.provider)
  const models = (group?.models ?? []).map(model => ({ id: model.id, name: model.name }))
  if (draft !== undefined && !models.some(option => option.id === draft.model)) models.push({ id: draft.model, name: draft.model })
  const model = group?.models.find(item => item.id === draft?.model)
  const efforts = (model?.reasoning?.efforts ?? []).map(effort => ({ id: effort.id, name: effort.name }))
  if (draft?.reasoningEffort !== undefined && !efforts.some(option => option.id === draft.reasoningEffort)) efforts.push({ id: draft.reasoningEffort, name: draft.reasoningEffort })
  return { providers, models, efforts }
}
export function useModelSwitchSettingsController(input: SettingsControllerInputs) {
  const main = input.useMainSettings(value => value)
  const subagent = input.useSubagentSettings(value => value)
  const [draft, setDraft] = useState<MainSettingsView | undefined>(main.value)
  const [groups, setGroups] = useState<readonly ModelProviderGroup[]>([])
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | undefined>()
  const locked = useRef(false); const acceptedRevision = useRef<number | undefined>()
  useEffect(() => { setDraft(main.value); setMessage(undefined); if (main.revision !== undefined && (acceptedRevision.current === undefined || main.revision > acceptedRevision.current)) acceptedRevision.current = main.revision }, [main.revision, main.value])
  useEffect(() => {
    let live = true
    const load = (): void => {
      void input.loadCatalog().then(value => { if (live) setGroups(value) }).catch(() => { if (live) setMessage(input.t('catalogFailed')) })
    }
    load()
    const stop = input.subscribeProviderOrder?.(() => { if (live) load() })
    return () => { live = false; stop?.() }
  }, [input.loadCatalog, input.subscribeProviderOrder, input.t])
  const { providers, models, efforts } = deriveMainChoices(groups, draft)
  const disabled = main.status !== 'ready' || !main.writable || draft === undefined || busy || draft.provider.trim() === '' || draft.model.trim() === ''
  const setProvider = (provider: string): void => setDraft(current => { if (current === undefined) return current; const first = groups.find(item => item.id === provider)?.models[0]; return selectRouteModel(groups, provider, first?.id ?? current.model) })
  const setModel = (id: string): void => setDraft(current => current === undefined ? current : selectRouteModel(groups, current.provider, id))
  const setReasoningEffort = (value: string): void => setDraft(current => { if (current === undefined) return current; const next = { ...current }; if (value === '') delete next.reasoningEffort; else next.reasoningEffort = value; return next })
  const reset = (): void => { setDraft(main.value); setMessage(undefined) }
  const save = async (): Promise<void> => {
    if (disabled || locked.current || draft === undefined) return
    const mirrorRevision = main.revision; if (mirrorRevision === undefined) { setMessage(input.t('requestFailed')); return }
    const expectedRevision = expectedMainRevision(mirrorRevision, acceptedRevision.current)
    locked.current = true; setBusy(true); setMessage(undefined)
    try { acceptedRevision.current = await input.saveMain(draft, expectedRevision); setMessage(input.t('saved')) }
    catch (error) { acceptedRevision.current = acceptedRevisionAfterFailure(acceptedRevision.current, error); setMessage(error instanceof Error ? error.message : input.t('requestFailed')) }
    finally { locked.current = false; setBusy(false) }
  }
  return { main, subagent, draft, groups, providers, models, efforts, busy, message, disabled, setProvider, setModel, setReasoningEffort, reset, save }
}
