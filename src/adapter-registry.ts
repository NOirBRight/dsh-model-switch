import type { WebSearchRequest, WebSearchResult } from '@deepseek-ai/dsh-web'

export interface SearchModel { readonly id: string; readonly name: string }
export interface SearchProviderMetadata { readonly id: string; readonly name: string; readonly models: readonly SearchModel[] }

export interface ModelSwitchSearchAdapter {
  readonly provider: string
  readonly label?: string
  /** Independent web_search models, not the conversational/native-network catalog. */
  readonly models?: readonly SearchModel[]
  supportsModel(model: string): boolean
  search(model: string, request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult>
}

export type ImageOutputFormat = 'png' | 'jpeg' | 'webp'
export interface ModelSwitchImageRequest {
  readonly prompt: string
  readonly path?: string
  readonly source?: string
  readonly outputFormat?: ImageOutputFormat
  readonly aspectRatio?: string
}
export interface ModelSwitchGeneratedImage {
  readonly path: string
  readonly mediaType: string
  readonly width: number
  readonly height: number
  readonly bytes?: number
  readonly attachmentId?: string
  readonly name?: string
  readonly revisedPrompt?: string
}
export interface ModelSwitchImageAdapter {
  readonly provider: string
  supportsModel(model: string): boolean
  generate(model: string, request: ModelSwitchImageRequest, execution: unknown): Promise<ModelSwitchGeneratedImage>
}
export interface ModelSwitchProviderAdapters {
  readonly provider: string
  readonly search?: ModelSwitchSearchAdapter
  readonly image?: ModelSwitchImageAdapter
}

function providerId(value: string, label: string): string {
  if (value.trim() === '') throw new Error(label + ' must be a non-empty string')
  return value
}

/** Lifecycle-owned registry for optional provider integrations. */
export class ModelSwitchAdapterRegistry {
  private readonly entries = new Map<string, ModelSwitchProviderAdapters>()
  private readonly listeners = new Set<() => void>()

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private changed(): void {
    for (const listener of this.listeners) listener()
  }

  /** Explicit projection: never serialize an executable adapter or its extra fields. */
  searchCatalog(): readonly SearchProviderMetadata[] {
    return this.list().flatMap(({ search }) => {
      if (search === undefined) return []
      const models = (search.models ?? []).filter(model => search.supportsModel(model.id))
        .map(model => ({ id: providerId(model.id, 'search model id'), name: providerId(model.name, 'search model name') }))
      return [{ id: search.provider, name: search.label ?? search.provider, models }]
    })
  }

  register(adapters: ModelSwitchProviderAdapters): () => void {
    const provider = providerId(adapters.provider, 'provider')
    if (adapters.search !== undefined && adapters.search.provider !== provider) throw new Error('search adapter provider must match registration provider')
    if (adapters.image !== undefined && adapters.image.provider !== provider) throw new Error('image adapter provider must match registration provider')
    if (this.entries.has(provider)) throw new Error('provider adapters already registered: ' + provider)
    this.entries.set(provider, adapters)
    this.changed()
    let active = true
    return () => {
      if (!active) return
      active = false
      if (this.entries.get(provider) === adapters) { this.entries.delete(provider); this.changed() }
    }
  }

  get(provider: string): ModelSwitchProviderAdapters | undefined { return this.entries.get(provider) }
  list(): readonly ModelSwitchProviderAdapters[] { return [...this.entries.values()] }
}
