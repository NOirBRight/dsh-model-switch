import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { decodeMainSettings, decodeModelSwitchSettings, deriveImageSettings, deriveSearchSettings, deriveSubagentSettings, IMAGE_SETTINGS_FIELDS, MAIN_SETTINGS_ID, MODEL_SWITCH_SETTINGS_ID, MainSettingsConflictError, SEARCH_SETTINGS_FIELDS, SUBAGENT_SETTINGS_FIELDS, type MainSettingsView } from '../client-contract.js'
import { deriveSettingsScope } from './derived-settings-scope.js'
import { RUNTIME_CAPABILITIES } from '../runtime-capabilities.js'
import { ModelSwitchSettings, type ModelSwitchSettingsFace } from './ModelSwitchSettings.js'
import { en, zh, type ModelSwitchLocaleKey } from './locales.js'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'settings.model-switch': ModelSwitchLocaleKey }
}

export const name = 'dsh-model-switch-client'
export const inject = ['slots', 'locale', 'settingsScope', 'connection']

export function apply(ctx: ClientContext): void {
  const localeNamespace = 'settings.model-switch'
  ctx.effect(() => ctx.locale.register(localeNamespace, { zh, en }), 'dsh-model-switch: localized Settings section')
  const t = ctx.locale.bind(localeNamespace) as ModelSwitchSettingsFace['t']
  const connection = ctx.get('connection') as ConnectionHandle
  const main = ctx.settingsScope.bind({ namespace: MAIN_SETTINGS_ID, decode: decodeMainSettings })
  const owned = ctx.settingsScope.bind({ namespace: MODEL_SWITCH_SETTINGS_ID, decode: decodeModelSwitchSettings })
  const subagent = deriveSettingsScope(owned, deriveSubagentSettings, SUBAGENT_SETTINGS_FIELDS)
  const search = deriveSettingsScope(owned, deriveSearchSettings, SEARCH_SETTINGS_FIELDS)
  const image = deriveSettingsScope(owned, deriveImageSettings, IMAGE_SETTINGS_FIELDS)
  const saveMain = async (next: MainSettingsView, expectedRevision: number): Promise<number> => {
    const result = await connection.api.settings.mutate({
      ns: MAIN_SETTINGS_ID, expectedRevision,
      ops: [
        { op: 'set', path: ['provider'], value: next.provider },
        { op: 'set', path: ['model'], value: next.model },
        next.reasoningEffort === undefined || next.reasoningEffort === ''
          ? { op: 'unset', path: ['reasoningEffort'] }
          : { op: 'set', path: ['reasoningEffort'], value: next.reasoningEffort },
      ],
    })
    if (!result.result.ok) {
      if (result.result.error.code === 'settings-conflict') throw new MainSettingsConflictError(t('conflict'))
      throw new Error(result.result.error.code + ': ' + result.result.error.message)
    }
    return result.result.value.revision
  }
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'model-switch', order: 9, label: () => t('nav'), locale: localeNamespace,
    inject: (): ModelSwitchSettingsFace => ({ t, hooks: { mainSettings: main, subagentSettings: subagent, searchSettings: search, imageSettings: image }, capabilities: RUNTIME_CAPABILITIES, saveMain, setSubagent: (field, value) => value === undefined ? subagent.unset(field) : subagent.set(field, value), setCapability: (route, field, value) => { const scope = route === 'search' ? search : image; return value === undefined ? scope.unset(field) : scope.set(field, value) }, loadCatalog: async () => {
      const response = await connection.api.llm.models({})
      if (!response.result.ok) throw new Error(t('catalogFailed'))
      return response.result.value.groups
    } }),
  }, ModelSwitchSettings))
}
