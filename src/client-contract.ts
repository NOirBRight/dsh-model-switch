export const MODEL_SWITCH_SETTINGS_ID = 'model-switch'
export const MAIN_SETTINGS_ID = 'agent-default-model'

export interface MainSettingsView { provider: string; model: string; reasoningEffort?: string }
export class MainSettingsConflictError extends Error {
  override readonly name = 'MainSettingsConflictError'
}
export interface ModelSwitchSettingsView {
  subagentMode: 'follow-main' | 'fixed'
  subagentProvider?: string; subagentModel?: string; subagentReasoningEffort?: string
}
export interface SubagentSettingsView { mode: 'follow-main' | 'fixed'; provider?: string; model?: string; reasoningEffort?: string }
export interface CapabilityRouteView { provider?: string; model?: string }

export const SUBAGENT_SETTINGS_FIELDS = Object.freeze({ mode: 'subagentMode', provider: 'subagentProvider', model: 'subagentModel' } as const)

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
    ...Object.fromEntries(['subagentProvider','subagentModel','subagentReasoningEffort']
      .flatMap((key) => { const field = optionalString(item[key]); return field === undefined ? [] : [[key, field]] })) as Omit<ModelSwitchSettingsView, 'subagentMode'>,
  }
}
export function deriveSubagentSettings(settings: ModelSwitchSettingsView): SubagentSettingsView {
  return { mode: settings.subagentMode, ...(settings.subagentProvider === undefined ? {} : { provider: settings.subagentProvider }), ...(settings.subagentModel === undefined ? {} : { model: settings.subagentModel }), ...(settings.subagentReasoningEffort === undefined ? {} : { reasoningEffort: settings.subagentReasoningEffort }) }
}
