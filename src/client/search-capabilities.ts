/** Host-owned search capability metadata, decoded at the Connection trust seam. */
import type { ModelProviderGroup } from '@deepseek-ai/dsh-api-session-controller/types'
import type { SearchModel, SearchProviderMetadata } from '../adapter-registry.js'
import type { CapabilitiesSnapshot } from '../capabilities-rpc.js'
import type { RuntimeCapabilities } from '../runtime-capabilities.js'
import { RUNTIME_CAPABILITIES } from '../runtime-capabilities.js'

export type { CapabilitiesSnapshot }

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function cleanId(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

function decodeModel(value: unknown): SearchModel | undefined {
  const item = record(value)
  const id = item === undefined ? undefined : cleanId(item.id)
  const name = item === undefined ? undefined : cleanId(item.name)
  return id === undefined || name === undefined ? undefined : { id, name }
}

/**
 * Strictly decode the Host search catalog into fresh plain metadata. Any malformed
 * entry fails the whole catalog (undefined): when the Host claims search is
 * available, invalid config must surface as an error, never hide as dropped rows.
 * Extra fields (functions, credentials) never survive: only id/name copy over.
 */
export function decodeSearchCatalog(value: unknown): SearchProviderMetadata[] | undefined {
  if (!Array.isArray(value)) return undefined
  const providers: SearchProviderMetadata[] = []
  for (const item of value) {
    const entry = record(item)
    const id = entry === undefined ? undefined : cleanId(entry.id)
    const name = entry === undefined ? undefined : cleanId(entry.name)
    if (entry === undefined || id === undefined || name === undefined || !Array.isArray(entry.models)) return undefined
    const models: SearchModel[] = []
    for (const model of entry.models) {
      const decoded = decodeModel(model)
      if (decoded === undefined) return undefined
      models.push(decoded)
    }
    providers.push({ id, name, models })
  }
  return providers
}

/**
 * Strictly decode one capabilities long-poll value; undefined when untrusted.
 * Only the decoded search block is taken from the network and overlaid onto the
 * frozen local defaults: no arbitrary Host fields pass through.
 */
export function decodeCapabilitiesSnapshot(value: unknown): CapabilitiesSnapshot | undefined {
  const payload = record(value)
  const revision = payload?.revision
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0) return undefined
  const capabilities = payload?.capabilities === undefined ? undefined : record(payload.capabilities)
  if (capabilities === undefined) return undefined
  const search = record(capabilities.searchProviderAdapters)
  if (search === undefined || typeof search.available !== 'boolean') return undefined
  if (search.providers !== undefined && (!Array.isArray(search.providers) || !search.providers.every((id): id is string => typeof id === 'string'))) return undefined
  const catalog = search.catalog === undefined ? [] : decodeSearchCatalog(search.catalog)
  if (catalog === undefined) return undefined
  return {
    revision,
    capabilities: { ...RUNTIME_CAPABILITIES, searchProviderAdapters: { available: search.available, providers: (search.providers ?? []) as readonly string[], catalog } },
  }
}

/** Project already-validated Host search metadata onto group shape (no re-decode). */
export function searchGroupsFromCapabilities(capabilities: RuntimeCapabilities | undefined): ModelProviderGroup[] {
  const catalog = capabilities?.searchProviderAdapters.catalog
  if (catalog === undefined) return []
  return catalog.map(provider => ({ id: provider.id, name: provider.name, models: provider.models.map(model => ({ id: model.id, name: model.name })) }))
}
