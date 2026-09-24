import type { Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

export type SubagentMode = 'follow-main' | 'fixed'

/** Resolved live values consumed by Model Switch. */
export interface ModelSwitchSettings {
  subagentMode: SubagentMode
  subagentProvider?: string
  subagentModel?: string
  subagentReasoningEffort?: string
  searchProvider?: string
  searchModel?: string
  imageProvider?: string
  imageModel?: string
  compactOnSwitch: boolean
}

/** Loader-owned references; every field is directly editable in the profile form. */
export interface Config {
  subagentMode: Volatile<SubagentMode>
  subagentProvider: Volatile<string | undefined>
  subagentModel: Volatile<string | undefined>
  subagentReasoningEffort: Volatile<string | undefined>
  searchProvider: Volatile<string | undefined>
  searchModel: Volatile<string | undefined>
  imageProvider: Volatile<string | undefined>
  imageModel: Volatile<string | undefined>
  compactOnSwitch: Volatile<boolean>
}

export const Config = z.object({
  subagentMode: z.union(['follow-main', 'fixed'] as const).default('follow-main').volatile(),
  subagentProvider: z.string().volatile(),
  subagentModel: z.string().volatile(),
  subagentReasoningEffort: z.string().volatile(),
  searchProvider: z.string().volatile(),
  searchModel: z.string().volatile(),
  imageProvider: z.string().volatile(),
  imageModel: z.string().volatile(),
  compactOnSwitch: z.boolean().default(true).volatile(),
})

export function readConfig(config: Config): ModelSwitchSettings {
  const subagentProvider = config.subagentProvider.get()
  const subagentModel = config.subagentModel.get()
  const subagentReasoningEffort = config.subagentReasoningEffort.get()
  const searchProvider = config.searchProvider.get()
  const searchModel = config.searchModel.get()
  const imageProvider = config.imageProvider.get()
  const imageModel = config.imageModel.get()
  return {
    subagentMode: config.subagentMode.get(),
    ...(subagentProvider === undefined ? {} : { subagentProvider }),
    ...(subagentModel === undefined ? {} : { subagentModel }),
    ...(subagentReasoningEffort === undefined ? {} : { subagentReasoningEffort }),
    ...(searchProvider === undefined ? {} : { searchProvider }),
    ...(searchModel === undefined ? {} : { searchModel }),
    ...(imageProvider === undefined ? {} : { imageProvider }),
    ...(imageModel === undefined ? {} : { imageModel }),
    compactOnSwitch: config.compactOnSwitch.get(),
  }
}
