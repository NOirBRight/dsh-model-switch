import { Context, Service } from '@deepseek-ai/cordis'
import type { ModelSelection } from '@deepseek-ai/dsh-agent'
import type { AgentDefaultModelConfig } from '@deepseek-ai/dsh-agent-default-model'
import type SettingsProvider from '@deepseek-ai/dsh-settings'
import { Config, MODEL_SWITCH_SETTINGS_NAMESPACE, type Config as ModelSwitchSettings } from './host-settings.js'
import { RUNTIME_CAPABILITIES } from './runtime-capabilities.js'
import { ModelSwitchAdapterRegistry } from './adapter-registry.js'
import { installModelSwitchSearchProvider } from './search-provider.js'
import { installGenerateImageTool } from './image-tool.js'
import { installCapabilitiesRpc } from './capabilities-rpc.js'
import { installDeepSeekSearchAdapter } from './deepseek-search-adapter.js'

declare module '@deepseek-ai/cordis' {
  interface Context { modelSwitch: ModelSwitchRuntime }
}

/** Host owner for Model Switch settings and the released Main-default adapter. */
export class ModelSwitchRuntime extends Service {
  static inject = ['agentDefaultModel']
  static Config = Config
  get capabilities() {
    const catalog = this.adapters.searchCatalog()
    return { ...RUNTIME_CAPABILITIES, searchProviderAdapters: { available: true, providers: catalog.map(provider => provider.id), catalog } }
  }
  readonly adapters = new ModelSwitchAdapterRegistry()
  private source: () => ModelSwitchSettings

  constructor(ctx: Context, entry: ModelSwitchSettings) {
    super(ctx, 'modelSwitch')
    this.source = () => entry
    installDeepSeekSearchAdapter(ctx)
    installModelSwitchSearchProvider(ctx, this)
    installCapabilitiesRpc(ctx, this.adapters, () => this.capabilities)
    const imageTool = installGenerateImageTool(ctx, this)
    const install = (settings: SettingsProvider): void => {
      settings.installSection(ctx, MODEL_SWITCH_SETTINGS_NAMESPACE, Config, entry, {
        setSource: (current) => { this.source = current },
        onChange: () => { void imageTool.reconcile().catch(error => { ctx.logger.error('Model Switch: failed to regenerate generate_image schema'); ctx.logger.error(error) }) },
      })
    }
    const settings = ctx.get('settings')
    if (settings === undefined) ctx.inject(['settings'], settingsCtx => install(settingsCtx.settings))
    else install(settings)
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
