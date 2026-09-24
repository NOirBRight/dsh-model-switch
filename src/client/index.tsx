import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { ModelSwitchSettingsView } from '../client-contract.js'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { deriveImageSettings, deriveSearchSettings, deriveSubagentSettings, IMAGE_SETTINGS_FIELDS, MAIN_DEFAULT_CONFIG_ID, MODEL_SWITCH_CONFIG_ID, MainSettingsConflictError, PROVIDERS_CONFIG_ID, SEARCH_SETTINGS_FIELDS, SUBAGENT_SETTINGS_FIELDS, type MainSettingsView } from '../client-contract.js'
import { deriveConfigForm } from './derived-config-form.js'
import { RUNTIME_CAPABILITIES } from '../runtime-capabilities.js'
import { decodeCapabilitiesSnapshot, type CapabilitiesSnapshot } from './search-capabilities.js'
import { ModelSwitchSettings, type ModelSwitchSettingsFace } from './ModelSwitchSettings.js'
import { en, zh, type ModelSwitchLocaleKey } from './locales.js'
import { callPluginRpc, type PluginRpcClient } from './plugin-rpc.ts'
import { fetchAntigravityCatalogGroups, readProviderRole, withAntigravityCatalog } from './antigravity-catalog.ts'
import { installComposerPicker, providerOrderStore } from './picker/install.tsx'
import type { ProviderOrderSettings } from 'dsh-llm-providers-ui/order'
import { readCatalogRoutes, sortCatalogGroupsWithRoutes, type ProviderDirectoryFace } from './provider-directory.ts'
import { installModelSwitchNavIcon } from './nav-icon.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'settings.model-switch': ModelSwitchLocaleKey }
}

export const name = 'dsh-model-switch-client'
export const inject = ['slots', 'locale', 'sessions', 'modelDirectories', 'configForms', 'remote', 'remote.session']

export function apply(ctx: ClientContext): void {
  installComposerPicker(ctx)
  ctx.effect(installModelSwitchNavIcon, 'dsh-model-switch: settings nav icon')
  const localeNamespace = 'settings.model-switch'
  ctx.effect(() => ctx.locale.register(localeNamespace, { zh, en }), 'dsh-model-switch: localized Settings section')
  const t = ctx.locale.bind(localeNamespace) as ModelSwitchSettingsFace['t']
  const remote = ctx.remote
  const mainForm = ctx.configForms.get<MainSettingsView>(MAIN_DEFAULT_CONFIG_ID)
  const owned = ctx.configForms.get<ModelSwitchSettingsView>(MODEL_SWITCH_CONFIG_ID)
  const main = deriveConfigForm(mainForm, value => value, {
    provider: 'provider',
    model: 'model',
    reasoningEffort: 'reasoningEffort',
  })
  const subagent = deriveConfigForm(owned, deriveSubagentSettings, SUBAGENT_SETTINGS_FIELDS)
  const search = deriveConfigForm(owned, deriveSearchSettings, SEARCH_SETTINGS_FIELDS)
  const image = deriveConfigForm(owned, deriveImageSettings, IMAGE_SETTINGS_FIELDS)
  const saveMain = async (next: MainSettingsView, expectedRevision: number): Promise<number> => {
    const accepted = await mainForm.mutate([
      { op: 'set', path: ['provider'], value: next.provider },
      { op: 'set', path: ['model'], value: next.model },
      next.reasoningEffort === undefined || next.reasoningEffort === ''
        ? { op: 'unset', path: ['reasoningEffort'] }
        : { op: 'set', path: ['reasoningEffort'], value: next.reasoningEffort },
    ], expectedRevision)
    if (!accepted) {
      if (mainForm.getSnapshot().revision !== expectedRevision) throw new MainSettingsConflictError(t('conflict'))
      throw new Error('settings-rejected')
    }
    const revision = mainForm.getSnapshot().revision
    if (revision === undefined) throw new Error('settings unavailable after save')
    return revision
  }
  const connectionRpc = ((): PluginRpcClient | undefined => {
    try {
      const connection = ctx.get('connection', false) as ConnectionHandle | undefined
      const rpc = connection?.rpc
      return rpc !== undefined && typeof rpc.call === 'function' ? rpc : undefined
    } catch {
      return undefined
    }
  })()
  const orderStore = providerOrderStore(ctx.configForms.get<ProviderOrderSettings>(PROVIDERS_CONFIG_ID))
  let directory: ProviderDirectoryFace | undefined
  ctx.inject(['providerDirectory'], scope => {
    const current = scope.get('providerDirectory', false) as ProviderDirectoryFace | undefined
    if (current === undefined || typeof current.subscribe !== 'function') return
    directory = current
    orderStore.invalidate()
    scope.effect(() => current.subscribe(orderStore.invalidate))
    scope.effect(() => () => {
      if (directory === current) directory = undefined
      orderStore.invalidate()
    })
  })
  const providerRoleOf = (key: string) => readProviderRole(directory, key) ?? 'llm'
  const subscribeProviderOrder = orderStore.subscribe
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'model-switch', order: 9, label: () => t('nav'), locale: localeNamespace,
    inject: (): ModelSwitchSettingsFace => ({ t, hooks: { mainSettings: main, subagentSettings: subagent, searchSettings: search, imageSettings: image, switchSettings: owned }, capabilities: RUNTIME_CAPABILITIES, saveMain, setSubagent: (field, value) => value === undefined ? subagent.unset(field) : subagent.set(field, value), setCapability: (route, field, value) => { const scope = route === 'search' ? search : image; return value === undefined ? scope.unset(field) : scope.set(field, value) }, setCompactOnSwitch: async value => { if (!await owned.set('compactOnSwitch', value)) throw new Error('settings-rejected') }, providerRoleOf, loadCatalog: async () => {
      const response = await remote.session.modelCatalog()
      if (!response.ok || response.value === undefined) throw new Error(t('catalogFailed'))
      const enabled = await fetchAntigravityCatalogGroups(connectionRpc)
      const order = orderStore.getSnapshot()
      return sortCatalogGroupsWithRoutes(withAntigravityCatalog(response.value.groups, enabled), order, readCatalogRoutes(directory))
        }, ...(connectionRpc === undefined ? {} : { loadCapabilities: async (revision?: number, signal?: AbortSignal): Promise<CapabilitiesSnapshot> => {
      const rpc = connectionRpc
      if (rpc === undefined) throw new Error(t('catalogFailed'))
      // Keep the Host capability endpoint out of the browser bundle.
      const response = await callPluginRpc(rpc, 'plugin-rpc/model-switch', 'capabilities', revision === undefined ? {} : { revision }, signal)
      if (!response.ok || response.value === undefined) throw new Error(t('catalogFailed'))
      const snapshot = decodeCapabilitiesSnapshot(response.value)
      if (snapshot === undefined) throw new Error(t('catalogFailed'))
      return snapshot
    } }), subscribeProviderOrder }),
  }, ModelSwitchSettings))
}
