import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { MODEL_SWITCH_SETTINGS_ID } from './client-contract.js'

export type SubagentMode = 'follow-main' | 'fixed'
export interface Config {
  subagentMode: SubagentMode
  subagentProvider?: string
  subagentModel?: string
  subagentReasoningEffort?: string
}

export const MODEL_SWITCH_SETTINGS_NAMESPACE = settingsNamespace(MODEL_SWITCH_SETTINGS_ID)
export const Config: z<Config> = z.object({
  subagentMode: z.union(['follow-main', 'fixed'] as const).default('follow-main'),
  subagentProvider: z.string(),
  subagentModel: z.string(),
  subagentReasoningEffort: z.string(),
})

export const DEFAULT_CONFIG: Config = { subagentMode: 'follow-main' }
