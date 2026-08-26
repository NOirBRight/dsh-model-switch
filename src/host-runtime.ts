import { Context, Service } from '@deepseek-ai/cordis'
import type { ModelSelection } from '@deepseek-ai/dsh-agent'
import type { AgentDefaultModelConfig } from '@deepseek-ai/dsh-agent-default-model'
import { installSettingsSection } from '@deepseek-ai/dsh-settings'
import { Config, MODEL_SWITCH_SETTINGS_NAMESPACE, type Config as ModelSwitchSettings } from './host-settings.js'
import { RUNTIME_CAPABILITIES } from './runtime-capabilities.js'

declare module '@deepseek-ai/cordis' {
  interface Context { modelSwitch: ModelSwitchRuntime }
}

/** Host owner for Model Switch settings and the released Main-default adapter. */
export class ModelSwitchRuntime extends Service {
  static inject = ['agentDefaultModel']
  static Config = Config
  readonly capabilities = RUNTIME_CAPABILITIES
  private source: () => ModelSwitchSettings

  constructor(ctx: Context, entry: ModelSwitchSettings) {
    super(ctx, 'modelSwitch')
    this.source = () => entry
    installSettingsSection(ctx, MODEL_SWITCH_SETTINGS_NAMESPACE, Config, entry, {
      setSource: (current) => { this.source = current },
      onChange: () => {},
    })
  }

  currentSettings(): ModelSwitchSettings { return { ...this.source() } }
  currentMainSelection(): ModelSelection { return { ...this.ctx.agentDefaultModel.currentSelection() } }
  async saveMainSelection(selection: ModelSelection): Promise<void> {
    await this.ctx.agentDefaultModel.saveSelection(selection)
  }
}

export interface MainDefaultPort {
  currentSelection(): ModelSelection
  saveSelection(selection: ModelSelection): Promise<void>
}

export function mainDefaultPort(service: AgentDefaultModelConfig): MainDefaultPort {
  return {
    currentSelection: () => ({ ...service.currentSelection() }),
    saveSelection: async (selection) => service.saveSelection(selection),
  }
}
