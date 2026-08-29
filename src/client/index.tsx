import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ModelProviderGroup } from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { decodeMainSettings, decodeModelSwitchSettings, deriveImageSettings, deriveSearchSettings, deriveSubagentSettings, IMAGE_SETTINGS_FIELDS, MAIN_SETTINGS_ID, MODEL_SWITCH_SETTINGS_ID, MainSettingsConflictError, SEARCH_SETTINGS_FIELDS, SUBAGENT_SETTINGS_FIELDS, type MainSettingsView } from '../client-contract.js'
import { deriveSettingsScope } from './derived-settings-scope.js'
import { RemoteSettingsScope, type RemoteSettingsFace } from './remote-settings-scope.js'
import { RUNTIME_CAPABILITIES } from '../runtime-capabilities.js'
import { ModelSwitchSettings, type ModelSwitchSettingsFace } from './ModelSwitchSettings.js'
import { en, zh, type ModelSwitchLocaleKey } from './locales.js'
import { installComposerPicker } from './picker/install.tsx'
import { installModelSwitchNavIcon } from './nav-icon.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'settings.model-switch': ModelSwitchLocaleKey }
}

export const name = 'dsh-model-switch-client'
export const inject = ['slots', 'locale', 'sessions', 'modelDirectories', 'settingsScope', 'remote', 'remote.settings', 'remote.session']

export function apply(ctx: ClientContext): void {
  installComposerPicker(ctx)
  ctx.effect(installModelSwitchNavIcon, 'dsh-model-switch: settings nav icon')
  const localeNamespace = 'settings.model-switch'
  ctx.effect(() => ctx.locale.register(localeNamespace, { zh, en }), 'dsh-model-switch: localized Settings section')
  const t = ctx.locale.bind(localeNamespace) as ModelSwitchSettingsFace['t']
  const remote = (ctx as unknown as { remote: { settings: RemoteSettingsFace; $on?(event: string, listener: () => void): () => void } }).remote
  const remoteSettings = remote.settings
  // Core ui-settings intentionally uses memory mode on non-loopback browsers.
  // Model Switch opts into the authenticated settings Remote for its own two
  // namespaces so the plugin page remains manageable through the trusted lab domain.
  const main = new RemoteSettingsScope(remoteSettings, MAIN_SETTINGS_ID, decodeMainSettings)
  const owned = new RemoteSettingsScope(remoteSettings, MODEL_SWITCH_SETTINGS_ID, decodeModelSwitchSettings)
  void Promise.all([main.reload(), owned.reload()])
  ctx.effect(() => remote.$on?.('settings/document-updated', () => { void main.reload(); void owned.reload() }) ?? (() => {}), 'dsh-model-switch: refresh Remote settings')
  const subagent = deriveSettingsScope(owned, deriveSubagentSettings, SUBAGENT_SETTINGS_FIELDS)
  const search = deriveSettingsScope(owned, deriveSearchSettings, SEARCH_SETTINGS_FIELDS)
  const image = deriveSettingsScope(owned, deriveImageSettings, IMAGE_SETTINGS_FIELDS)
  const saveMain = async (next: MainSettingsView, expectedRevision: number): Promise<number> => {
    const result = await remoteSettings.mutate(MAIN_SETTINGS_ID, [
      { op: 'set', path: ['provider'], value: next.provider },
      { op: 'set', path: ['model'], value: next.model },
      next.reasoningEffort === undefined || next.reasoningEffort === ''
        ? { op: 'unset', path: ['reasoningEffort'] }
        : { op: 'set', path: ['reasoningEffort'], value: next.reasoningEffort },
    ], expectedRevision)
    if (!result.ok) {
      const code = result.error?.code ?? 'settings-error'
      if (code === 'settings-conflict') throw new MainSettingsConflictError(t('conflict'))
      throw new Error(code + ': ' + (result.error?.message ?? ''))
    }
    await main.reload()
    return result.value?.revision ?? expectedRevision
  }
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'model-switch', order: 9, label: () => t('nav'), locale: localeNamespace,
    inject: (): ModelSwitchSettingsFace => ({ t, hooks: { mainSettings: main, subagentSettings: subagent, searchSettings: search, imageSettings: image }, capabilities: RUNTIME_CAPABILITIES, saveMain, setSubagent: (field, value) => value === undefined ? subagent.unset(field) : subagent.set(field, value), setCapability: (route, field, value) => { const scope = route === 'search' ? search : image; return value === undefined ? scope.unset(field) : scope.set(field, value) }, loadCatalog: async () => {
      const response = await (ctx as unknown as { remote: { session: { modelCatalog(): Promise<{ ok: boolean; value?: { groups: readonly ModelProviderGroup[] }; error?: { message: string } }> } } }).remote.session.modelCatalog()
      if (!response.ok || response.value === undefined) throw new Error(t('catalogFailed'))
      return response.value.groups
    } }),
  }, ModelSwitchSettings))
}
