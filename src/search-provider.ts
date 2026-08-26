import type { Context } from '@deepseek-ai/cordis'
import type { WebSearchProvider, WebSearchRequest, WebSearchResult } from '@deepseek-ai/dsh-web'
import type { ModelSwitchAdapterRegistry } from './adapter-registry.js'

export const MODEL_SWITCH_SEARCH_PROVIDER_ID = 'model-switch'
interface SearchSettings { readonly searchProvider?: string; readonly searchModel?: string }

function selected(settings: SearchSettings): { provider: string; model: string } | undefined {
  const provider = settings.searchProvider?.trim()
  const model = settings.searchModel?.trim()
  if (provider === undefined || provider === '' || model === undefined || model === '') return undefined
  return { provider, model }
}

/** Thin official WebSearchProvider that resolves Model Switch routing at execution time. */
export class ModelSwitchSearchProvider implements WebSearchProvider {
  readonly id = MODEL_SWITCH_SEARCH_PROVIDER_ID
  constructor(private readonly settings: () => SearchSettings, private readonly adapters: ModelSwitchAdapterRegistry) {}

  available(): boolean {
    const route = selected(this.settings())
    if (route === undefined) return false
    const adapter = this.adapters.get(route.provider)?.search
    return adapter !== undefined && adapter.supportsModel(route.model)
  }

  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    const route = selected(this.settings())
    if (route === undefined) throw new Error('search provider and model must be configured in Model Switch')
    const adapter = this.adapters.get(route.provider)?.search
    if (adapter === undefined) throw new Error('missing search adapter: ' + route.provider)
    if (!adapter.supportsModel(route.model)) throw new Error('search model is not supported by adapter: ' + route.provider + '/' + route.model)
    return adapter.search(route.model, request, signal)
  }
}

export interface SearchProviderRuntime { currentSettings(): SearchSettings; readonly adapters: ModelSwitchAdapterRegistry }
export function installModelSwitchSearchProvider(ctx: Context, runtime: SearchProviderRuntime): void {
  ctx.inject(['web'], scope => scope.effect(
    () => scope.web.registerSearchProvider(new ModelSwitchSearchProvider(() => runtime.currentSettings(), runtime.adapters)),
    'Model Switch: register thin Search provider',
  ))
}
