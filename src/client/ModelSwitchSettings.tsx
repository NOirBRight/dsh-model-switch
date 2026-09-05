import { useEffect, useState, type ReactNode } from 'react'
import type { ModelProviderGroup } from '@deepseek-ai/dsh-api-session-controller/types'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { CapabilityRouteView, MainSettingsView, SubagentSettingsView } from '../client-contract.js'
import type { RuntimeCapabilities } from '../runtime-capabilities.js'
import { searchGroupsFromCapabilities, type CapabilitiesSnapshot } from './search-capabilities.js'
import type { ModelSwitchLocaleKey } from './locales.js'
import { isAgentRole } from './antigravity-catalog.ts'
import { deriveRouteChoices, selectRouteModel, useModelSwitchSettingsController, type Choice } from './main-row-controller.js'
import css from './ModelSwitchSettings.module.css'

export interface ModelSwitchSettingsFace {
  t: (key: ModelSwitchLocaleKey) => string
  hooks: { mainSettings: SettingsScope<MainSettingsView>; subagentSettings: SettingsScope<SubagentSettingsView>; searchSettings: SettingsScope<CapabilityRouteView>; imageSettings: SettingsScope<CapabilityRouteView> }
  capabilities: RuntimeCapabilities
  saveMain: (next: MainSettingsView, expectedRevision: number) => Promise<number>
  setSubagent: (field: 'mode' | 'provider' | 'model' | 'effort', value: string | undefined) => Promise<void>
  setCapability: (route: 'search' | 'image', field: 'provider' | 'model', value: string | undefined) => Promise<void>
  loadCatalog: () => Promise<readonly ModelProviderGroup[]>
  /** Host capabilities long-poll; absent in legacy faces, which keep the static-capabilities path. */
  loadCapabilities?: (revision?: number, signal?: AbortSignal) => Promise<CapabilitiesSnapshot>
  subscribeProviderOrder?: (listener: () => void) => () => void
  /** ProviderDirectory-owned role lookup; absent when the owner seam is unavailable. */
  providerRoleOf?: (key: string) => string
}

export type ModelSwitchSettingsProps = PropsRuntime<'settings.section'> & InjectFace<ModelSwitchSettingsFace>
type RouteId = 'main' | 'subagent' | 'search' | 'image'
type RouteIconKind = RouteId

function cx(...values: Array<string | undefined | false>): string { return values.filter(Boolean).join(' ') }
function compact(...values: Array<string | undefined>): string { return values.filter((value): value is string => value !== undefined && value !== '').join(' · ') }

function RouteIcon({ kind }: { kind: RouteIconKind }): ReactNode {
  if (kind === 'main') return <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3 4.5h12v8H8l-3.5 2v-2H3v-8Z" stroke="currentColor" strokeLinejoin="round" /></svg>
  if (kind === 'subagent') return <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><circle cx="6" cy="6" r="2.5" stroke="currentColor" /><circle cx="12.5" cy="11.5" r="2" stroke="currentColor" /><path d="M3 14c.4-2.5 1.6-4 3-4s2.6 1.5 3 4M10 7.5c.5-.8 1.3-1.2 2.2-1.2 1.5 0 2.6 1 2.8 2.7" stroke="currentColor" strokeLinecap="round" /></svg>
  if (kind === 'search') return <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="4.5" stroke="currentColor" /><path d="m11.5 11.5 3.5 3.5" stroke="currentColor" strokeLinecap="round" /></svg>
  if (kind === 'image') return <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><rect x="2.5" y="3" width="13" height="12" rx="2" stroke="currentColor" /><circle cx="6.5" cy="7" r="1.3" stroke="currentColor" /><path d="m4 13 3.5-3 2.2 2 1.8-1.6 2.5 2.6" stroke="currentColor" strokeLinejoin="round" /></svg>
  return null
}

function RouteCard({ title, summary, icon, open, onToggle, disabled = false, badge, badgeWarn = false, children }: {
  title: string; summary: string; icon: RouteIconKind; open: boolean; onToggle: () => void; disabled?: boolean; badge?: string; badgeWarn?: boolean; children?: ReactNode
}): ReactNode {
  return <article className={cx(css.routeCard, open && css.routeCardOpen, disabled && css.routeCardUnavailable)}>
    <button type="button" className={css.routeHeader} disabled={disabled} aria-expanded={disabled ? undefined : open} onClick={onToggle}>
      <span className={css.routeIcon}><RouteIcon kind={icon} /></span>
      <span className={css.routeCopy}>
        <span className={css.routeName}>{title}{badge === undefined ? null : <i className={cx(css.badge, badgeWarn && css.badgeWarn)}>{badge}</i>}</span>
        <span className={css.routeSummary}>{summary}</span>
      </span>
      {disabled ? null : <svg className={css.chevron} width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="m4 5 3 3 3-3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </button>
    {open && !disabled ? <div className={css.cardBody}>{children}</div> : null}
  </article>
}

function Field({ label, value, disabled, choices, onChange, full = false }: { label: string; value: string | undefined; disabled: boolean; choices: readonly Choice[]; onChange: (value: string) => void; full?: boolean }): ReactNode {
  return <label className={cx(css.field, full && css.fieldFull)}><span className={css.fieldLabel}>{label}</span><select className={css.input} disabled={disabled} value={value ?? ''} onChange={event => { onChange(event.target.value) }}><option value="">—</option>{choices.map(option => <option key={option.id} value={option.id}>{option.name}{option.unavailable === true ? ' ⚠' : ''}</option>)}</select></label>
}

function Actions({ t, busy, disabled, message, onCancel, onSave }: { t: ModelSwitchSettingsFace['t']; busy: boolean; disabled: boolean; message?: string; onCancel: () => void; onSave: () => void }): ReactNode {
  return <div className={css.cardFooter}>{message === undefined ? null : <p className={cx(css.hint, css.message)}>{message}</p>}<button type="button" className={cx(css.button, css.secondaryButton)} disabled={busy} onClick={onCancel}>{t('cancel')}</button><button type="button" className={cx(css.button, css.primaryButton)} disabled={disabled} onClick={onSave}>{busy ? t('saving') : t('save')}</button></div>
}

function useDraft<T>(snapshot: SettingsScopeSnapshot<T>): [T | undefined, (value: T | undefined) => void, () => void] {
  const [draft, setDraft] = useState<T | undefined>(snapshot.value)
  useEffect(() => { setDraft(snapshot.value) }, [snapshot.revision, snapshot.value])
  return [draft, setDraft, () => { setDraft(snapshot.value) }]
}

function routeName(groups: readonly ModelProviderGroup[], route: CapabilityRouteView | undefined): string {
  if (route === undefined) return ''
  const provider = groups.find(group => group.id === route.provider)
  const model = provider?.models.find(item => item.id === route.model)
  return compact(provider?.name ?? route.provider, model?.name ?? route.model)
}

function routeDefaultEffort(groups: readonly ModelProviderGroup[], route: CapabilityRouteView | undefined): string | undefined {
  if (route === undefined) return undefined
  return groups.find(group => group.id === route.provider)?.models.find(model => model.id === route.model)?.reasoning?.defaultEffort
}

function capabilityChoices(groups: readonly ModelProviderGroup[], route: CapabilityRouteView | undefined, providers: readonly string[] | undefined, kind: 'search' | 'image'): { providers: Choice[]; models: Choice[] } {
  const choices = deriveRouteChoices(groups, route, providers)
  if (kind === 'image' && route?.provider === 'grok') {
    const models: Choice[] = [{ id: 'grok-imagine-image-quality', name: 'Grok Imagine 1.0' }]
    if (route.model !== undefined && !models.some(model => model.id === route.model)) models.push({ id: route.model, name: route.model, unavailable: true })
    return { providers: choices.providers, models }
  }
  return choices
}

export function ModelSwitchSettings(props: ModelSwitchSettingsProps): ReactNode {
  const controller = useModelSwitchSettingsController(props)
  const { main, subagent, draft, groups } = controller
  const search = props.useSearchSettings(value => value)
  const image = props.useImageSettings(value => value)
  const [open, setOpen] = useState<RouteId | undefined>()
  const [subagentDraft, setSubagentDraft, resetSubagent] = useDraft(subagent)
  const [searchDraft, setSearchDraft, resetSearch] = useDraft(search)
  const [imageDraft, setImageDraft, resetImage] = useDraft(image)
  const [busy, setBusy] = useState<RouteId | undefined>()
  const [message, setMessage] = useState<{ route: RouteId; text: string } | undefined>()
  const loadSearchCapabilities = props.loadCapabilities
  const [searchSnapshot, setSearchSnapshot] = useState<CapabilitiesSnapshot | undefined>(undefined)
  const [searchError, setSearchError] = useState<string | undefined>(undefined)
  // ponytail: one effect owns the Host long-poll chain (initial fetch, revision follow-ups, bounded retry, abort).
  useEffect(() => {
    if (loadSearchCapabilities === undefined) return
    let live = true
    const scope = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let failures = 0
    let signature: string | undefined
    const poll = async (revision: number | undefined): Promise<void> => {
      try {
        const snapshot = await loadSearchCapabilities(revision, scope.signal)
        if (!live) return
        // Revisions belong to an RPC owner; compare content to accept restarts without heartbeat renders.
        const nextSignature = JSON.stringify(snapshot)
        if (signature !== nextSignature || failures > 0) {
          signature = nextSignature
          setSearchSnapshot(snapshot)
          setSearchError(undefined)
        }
        failures = 0
        void poll(snapshot.revision)
      } catch (error) {
        if (!live || scope.signal.aborted) return
        failures = Math.min(failures + 1, 8)
        if (failures >= 3) setSearchError(error instanceof Error ? error.message : props.t('catalogFailed'))
        // Stay fail-closed but recover without remounting; retry delay is capped at the Host heartbeat.
        timer = setTimeout(() => { if (live) void poll(undefined) }, Math.min(250 * 2 ** (failures - 1), 20_000))
      }
    }
    void poll(undefined)
    return () => { live = false; scope.abort(); if (timer !== undefined) clearTimeout(timer) }
  }, [loadSearchCapabilities])
  const unavailable = (key: keyof RuntimeCapabilities): string => { const reason = props.capabilities[key].reason; return reason === undefined ? props.t('unavailable') : props.t(('reason.' + reason) as ModelSwitchLocaleKey) }
  const toggle = (route: RouteId): void => { setOpen(current => current === route ? undefined : route); setMessage(undefined) }
  const subagentRoute = subagentDraft === undefined ? undefined : { ...(subagentDraft.provider === undefined ? {} : { provider: subagentDraft.provider }), ...(subagentDraft.model === undefined ? {} : { model: subagentDraft.model }) }
  const subagentChoices = deriveRouteChoices(groups, subagentRoute)
  const subagentEfforts = ((): Choice[] => {
    const group = groups.find(item => item.id === subagentRoute?.provider)
    const efforts = (group?.models.find(item => item.id === subagentRoute?.model)?.reasoning?.efforts ?? []).map(effort => ({ id: effort.id, name: effort.name }))
    if (subagentDraft?.reasoningEffort !== undefined && !efforts.some(option => option.id === subagentDraft.reasoningEffort)) efforts.push({ id: subagentDraft.reasoningEffort, name: subagentDraft.reasoningEffort })
    return efforts
  })()
  const defaultEffort = subagentDraft?.reasoningEffort ?? routeDefaultEffort(groups, subagentRoute)
  const mainEffectiveEffort = draft?.reasoningEffort ?? routeDefaultEffort(groups, draft)
  const searchLive = searchSnapshot?.capabilities
  const searchGroups = searchGroupsFromCapabilities(searchLive)
  const searchChoices = capabilityChoices(searchGroups, searchDraft, undefined, 'search')
  const searchAvailable = searchLive?.searchProviderAdapters.available ?? false
  const imageChoices = capabilityChoices(groups, imageDraft, props.capabilities.imageProviderAdapters.providers ?? [], 'image')
  const synced = [main, subagent, search, image].every(snapshot => snapshot.status === 'ready')
  const run = async (route: RouteId, operation: () => Promise<void>): Promise<void> => {
    if (busy !== undefined) return
    setBusy(route); setMessage(undefined)
    try { await operation(); setMessage({ route, text: props.t('saved') }) }
    catch (error) { setMessage({ route, text: error instanceof Error ? error.message : props.t('requestFailed') }) }
    finally { setBusy(undefined) }
  }
  const saveSubagent = (): void => { if (subagentDraft === undefined) return; void run('subagent', async () => {
    if (subagent.value?.mode !== subagentDraft.mode) await props.setSubagent('mode', subagentDraft.mode)
    if (subagentDraft.mode === 'fixed') {
      if (subagent.value?.provider !== subagentDraft.provider) await props.setSubagent('provider', subagentDraft.provider)
      if (subagent.value?.model !== subagentDraft.model) await props.setSubagent('model', subagentDraft.model)
      const nextEffort = subagentDraft.reasoningEffort === '' ? undefined : subagentDraft.reasoningEffort
      if (subagent.value?.reasoningEffort !== nextEffort) await props.setSubagent('effort', nextEffort)
    }
  }) }
  const saveCapability = (route: 'search' | 'image', current: SettingsScopeSnapshot<CapabilityRouteView>, next: CapabilityRouteView | undefined): void => { if (next === undefined) return; void run(route, async () => {
    if (current.value?.provider !== next.provider) await props.setCapability(route, 'provider', next.provider)
    if (current.value?.model !== next.model) await props.setCapability(route, 'model', next.model)
  }) }
  const mainSummary = draft === undefined ? props.t('loading') : compact(routeName(groups, draft), mainEffectiveEffort)
  const subagentRole = subagentDraft?.mode === 'fixed' && subagentDraft.provider !== undefined && subagentDraft.provider !== '' ? props.providerRoleOf?.(subagentDraft.provider) : undefined
  const subagentSummary = subagentDraft?.mode === 'follow-main' ? props.t('subagentFollowMain') : compact(props.t('subagentFixed'), routeName(groups, subagentRoute), isAgentRole(subagentRole) ? props.t('agentBadge') : undefined, defaultEffort === undefined ? props.t('providerDefaultShort') : compact(props.t('providerDefaultShort'), defaultEffort))
  const subagentDisabled = subagent.status !== 'ready' || !subagent.writable || subagentDraft === undefined || busy === 'subagent' || (subagentDraft.mode === 'fixed' && ((subagentDraft.provider ?? '').trim() === '' || (subagentDraft.model ?? '').trim() === ''))
  const capabilityDisabled = (route: 'search' | 'image', snapshot: SettingsScopeSnapshot<CapabilityRouteView>, next: CapabilityRouteView | undefined): boolean => snapshot.status !== 'ready' || !snapshot.writable || next === undefined || busy === route || (next.provider ?? '').trim() === '' || (next.model ?? '').trim() === ''

  return <main className={css.section}>
    <h1 className={css.title}>{props.t('title')}</h1>
    <p className={css.intro}>{props.t('subtitle')}</p>
    <p className={css.saved}><i className={css.savedDot} />{synced ? props.t('settingsSynced') : props.t('loading')}</p>

    <section className={css.group}><h2 className={css.groupLabel}>{props.t('conversationRoutes')}</h2>
      <RouteCard title={props.t('main')} summary={mainSummary} icon="main" open={open === 'main'} onToggle={() => { toggle('main') }} badge={props.t('defaultBadge')}>
        {draft === undefined ? <p className={css.hint}>{props.t('loading')}</p> : <><div className={css.formGrid}>
          <Field label={props.t('provider')} value={draft.provider} disabled={controller.busy || !main.writable} choices={controller.providers} onChange={controller.setProvider} />
          <Field label={props.t('model')} value={draft.model} disabled={controller.busy || !main.writable} choices={controller.models} onChange={controller.setModel} />
          <Field label={props.t('effort')} value={draft.reasoningEffort ?? ''} disabled={controller.busy || !main.writable} choices={controller.efforts} onChange={controller.setReasoningEffort} />
        </div>{!main.writable && main.status === 'ready' ? <p className={css.hint}>{props.t('readonly')}</p> : null}<Actions t={props.t} busy={controller.busy} disabled={controller.disabled} {...(controller.message === undefined ? {} : { message: controller.message })} onCancel={controller.reset} onSave={() => { void controller.save() }} /></>}
      </RouteCard>

      {props.capabilities.centralSubagentRouting.available ? <RouteCard title={props.t('subagent')} summary={subagentSummary} icon="subagent" open={open === 'subagent'} onToggle={() => { toggle('subagent') }}>
        {subagentDraft === undefined ? <p className={css.hint}>{props.t('loading')}</p> : <><div className={css.formGrid}>
          <label className={cx(css.field, css.fieldFull)}><span className={css.fieldLabel}>{props.t('subagentMode')}</span><select className={css.input} disabled={busy === 'subagent' || !subagent.writable} value={subagentDraft.mode} onChange={event => { setSubagentDraft({ ...subagentDraft, mode: event.target.value as SubagentSettingsView['mode'] }) }}><option value="fixed">{props.t('subagentFixed')}</option><option value="follow-main">{props.t('subagentFollowMain')}</option></select></label>
          {subagentDraft.mode === 'fixed' ? <><Field label={props.t('provider')} value={subagentDraft.provider ?? ''} disabled={busy === 'subagent' || !subagent.writable} choices={subagentChoices.providers} onChange={provider => { const first = groups.find(group => group.id === provider)?.models[0]; setSubagentDraft({ mode: subagentDraft.mode, ...selectRouteModel(groups, provider, first?.id ?? subagentDraft.model ?? '') }) }} /><Field label={props.t('model')} value={subagentDraft.model ?? ''} disabled={busy === 'subagent' || !subagent.writable} choices={subagentChoices.models} onChange={model => { setSubagentDraft({ mode: subagentDraft.mode, ...selectRouteModel(groups, subagentDraft.provider ?? '', model) }) }} /><Field label={props.t('effort')} value={subagentDraft.reasoningEffort ?? ''} disabled={busy === 'subagent' || !subagent.writable} choices={subagentEfforts} onChange={effort => { setSubagentDraft({ ...subagentDraft, reasoningEffort: effort }) }} /></> : null}
        </div><Actions t={props.t} busy={busy === 'subagent'} disabled={subagentDisabled} {...(message?.route === 'subagent' ? { message: message.text } : {})} onCancel={() => { resetSubagent(); setMessage(undefined) }} onSave={saveSubagent} /></>}
      </RouteCard> : <RouteCard title={props.t('subagent')} summary={unavailable('centralSubagentRouting')} icon="subagent" open={false} onToggle={() => {}} disabled badge={props.t('unavailable')} badgeWarn />}
    </section>

    <section className={css.group}><h2 className={css.groupLabel}>{props.t('capabilityRoutes')}</h2>
      {searchAvailable ? <RouteCard title={props.t('search')} summary={searchDraft === undefined ? props.t('loading') : routeName(searchGroups, searchDraft)} icon="search" open={open === 'search'} onToggle={() => { toggle('search') }}>
        {searchDraft === undefined ? <p className={css.hint}>{props.t('loading')}</p> : <><p className={css.hint}>{props.t('searchHelp')}</p>{searchError === undefined ? null : <p className={css.hint}>{searchError}</p>}<div className={css.formGrid}>
          <Field label={props.t('provider')} value={searchDraft.provider} disabled={busy === 'search' || !search.writable || searchError !== undefined} choices={searchChoices.providers} onChange={provider => { const first = searchGroups.find(group => group.id === provider)?.models[0]; setSearchDraft({ provider, ...(first === undefined ? {} : { model: first.id }) }) }} />
          <Field label={props.t('model')} value={searchDraft.model} disabled={busy === 'search' || !search.writable || searchError !== undefined} choices={searchChoices.models} onChange={model => { setSearchDraft({ ...searchDraft, model }) }} />
        </div><Actions t={props.t} busy={busy === 'search'} disabled={capabilityDisabled('search', search, searchDraft) || searchError !== undefined || !searchGroups.some(group => group.id === searchDraft.provider && group.models.some(model => model.id === searchDraft.model))} {...(message?.route === 'search' ? { message: message.text } : {})} onCancel={() => { resetSearch(); setMessage(undefined) }} onSave={() => { saveCapability('search', search, searchDraft) }} /></>}
      </RouteCard> : <RouteCard title={props.t('search')} summary={searchError ?? unavailable('searchProviderAdapters')} icon="search" open={false} onToggle={() => {}} disabled badge={props.t('unavailable')} badgeWarn />}

      {props.capabilities.imageProviderAdapters.available ? <RouteCard title={props.t('image')} summary={imageDraft === undefined ? props.t('loading') : routeName(groups, imageDraft)} icon="image" open={open === 'image'} onToggle={() => { toggle('image') }}>
        {imageDraft === undefined ? <p className={css.hint}>{props.t('loading')}</p> : <><p className={css.hint}>{props.t('imageHelp')}</p><div className={css.formGrid}>
          <Field label={props.t('provider')} value={imageDraft.provider} disabled={busy === 'image' || !image.writable} choices={imageChoices.providers} onChange={provider => { const model = provider === 'grok' ? 'grok-imagine-image-quality' : groups.find(group => group.id === provider)?.models[0]?.id; setImageDraft({ provider, ...(model === undefined ? {} : { model }) }) }} />
          <Field label={props.t('model')} value={imageDraft.model} disabled={busy === 'image' || !image.writable} choices={imageChoices.models} onChange={model => { setImageDraft({ ...imageDraft, model }) }} />
        </div><Actions t={props.t} busy={busy === 'image'} disabled={capabilityDisabled('image', image, imageDraft)} {...(message?.route === 'image' ? { message: message.text } : {})} onCancel={() => { resetImage(); setMessage(undefined) }} onSave={() => { saveCapability('image', image, imageDraft) }} /></>}
      </RouteCard> : <RouteCard title={props.t('image')} summary={unavailable('imageProviderAdapters')} icon="image" open={false} onToggle={() => {}} disabled badge={props.t('unavailable')} badgeWarn />}
    </section>

  </main>
}
