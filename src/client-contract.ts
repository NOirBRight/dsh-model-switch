export const MODEL_SWITCH_SETTINGS_ID = 'model-switch'
export const MAIN_SETTINGS_ID = 'agent-default-model'

export interface MainSettingsView { provider: string; model: string; reasoningEffort?: string }
export class MainSettingsConflictError extends Error {
  override readonly name = 'MainSettingsConflictError'
}
export interface ModelSwitchSettingsView {
  subagentMode: 'follow-main' | 'fixed'
  subagentProvider?: string; subagentModel?: string; subagentReasoningEffort?: string
  searchProvider?: string; searchModel?: string
  imageProvider?: string; imageModel?: string
}
export interface SubagentSettingsView { mode: 'follow-main' | 'fixed'; provider?: string; model?: string; reasoningEffort?: string }
export interface CapabilityRouteView { provider?: string; model?: string }

export const SUBAGENT_SETTINGS_FIELDS = Object.freeze({ mode: 'subagentMode', provider: 'subagentProvider', model: 'subagentModel' } as const)
export const SEARCH_SETTINGS_FIELDS = Object.freeze({ provider: 'searchProvider', model: 'searchModel' } as const)
export const IMAGE_SETTINGS_FIELDS = Object.freeze({ provider: 'imageProvider', model: 'imageModel' } as const)

function record(value: unknown): Record<string, unknown> | undefined { return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined }
function optionalString(value: unknown): string | undefined { return typeof value === 'string' ? value : undefined }
export function decodeMainSettings(value: unknown): MainSettingsView | undefined {
  const item = record(value)
  if (item === undefined || typeof item.provider !== 'string' || typeof item.model !== 'string') return undefined
  const effort = optionalString(item.reasoningEffort)
  return { provider: item.provider, model: item.model, ...(effort === undefined ? {} : { reasoningEffort: effort }) }
}
export function decodeModelSwitchSettings(value: unknown): ModelSwitchSettingsView | undefined {
  const item = record(value)
  if (item === undefined || (item.subagentMode !== 'follow-main' && item.subagentMode !== 'fixed')) return undefined
  return {
    subagentMode: item.subagentMode,
    ...Object.fromEntries(['subagentProvider','subagentModel','subagentReasoningEffort','searchProvider','searchModel','imageProvider','imageModel']
      .flatMap((key) => { const field = optionalString(item[key]); return field === undefined ? [] : [[key, field]] })) as Omit<ModelSwitchSettingsView, 'subagentMode'>,
  }
}
export function deriveSubagentSettings(settings: ModelSwitchSettingsView): SubagentSettingsView {
  return { mode: settings.subagentMode, ...(settings.subagentProvider === undefined ? {} : { provider: settings.subagentProvider }), ...(settings.subagentModel === undefined ? {} : { model: settings.subagentModel }), ...(settings.subagentReasoningEffort === undefined ? {} : { reasoningEffort: settings.subagentReasoningEffort }) }
}
export function deriveSearchSettings(settings: ModelSwitchSettingsView): CapabilityRouteView { return { ...(settings.searchProvider === undefined ? {} : { provider: settings.searchProvider }), ...(settings.searchModel === undefined ? {} : { model: settings.searchModel }) } }
export function deriveImageSettings(settings: ModelSwitchSettingsView): CapabilityRouteView { return { ...(settings.imageProvider === undefined ? {} : { provider: settings.imageProvider }), ...(settings.imageModel === undefined ? {} : { model: settings.imageModel }) } }
