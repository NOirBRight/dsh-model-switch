/** DSH-parent subagent access to the Antigravity Enabled catalog. */

import type { ModelProviderGroup } from '@deepseek-ai/dsh-api-session-controller/types'
import { mergePickerGroups } from './picker/external-catalog.ts'

/** Provider key owned by the Antigravity card. */
export const ANTIGRAVITY_PROVIDER_KEY = 'antigravity'

/** Agent role owned by ProviderDirectory (dsh-llm-providers-ui), never hardcoded by Model Switch. */
export const AGENT_ROLE = 'agent'

/**
 * Released Antigravity settings RPC seam (dsh-acp-antigravity client-contract).
 * Kept as literals: the Antigravity plugin is not a Model Switch dependency.
 */
export const ANTIGRAVITY_CATALOG_CHANNEL = '/dsh-acp-antigravity'
export const ANTIGRAVITY_CATALOG_ENDPOINT = 'catalog'

interface CatalogRpc {
  call(channel: string, endpoint: string, payload: unknown, extra: undefined): Promise<{ ok: boolean; value?: unknown }>
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

/** Strictly decode one Enabled-catalog group; malformed groups are dropped, never thrown. */
function decodeGroup(value: unknown): ModelProviderGroup | undefined {
  const group = record(value)
  if (group === undefined || typeof group.id !== 'string' || typeof group.name !== 'string' || !Array.isArray(group.models)) return undefined
  const models: { id: string; name: string }[] = []
  for (const item of group.models) {
    const model = record(item)
    if (model === undefined || typeof model.id !== 'string' || typeof model.name !== 'string') continue
    models.push({ id: model.id, name: model.name })
  }
  if (models.length === 0) return undefined
  return { id: group.id, name: group.name, models }
}

/** Decode the Enabled-catalog payload; anything malformed decodes to no groups. */
export function decodeAntigravityCatalogGroups(value: unknown): ModelProviderGroup[] {
  const payload = record(value)
  if (payload === undefined || !Array.isArray(payload.groups)) return []
  const groups: ModelProviderGroup[] = []
  for (const item of payload.groups) {
    const group = decodeGroup(item)
    if (group !== undefined) groups.push(group)
  }
  return groups
}

/**
 * Read the Enabled catalog; resolves to no groups when Antigravity is absent,
 * unreachable, or malformed. Never throws: the Host catalog stays authoritative.
 */
export async function fetchAntigravityCatalogGroups(rpc: CatalogRpc | undefined): Promise<ModelProviderGroup[]> {
  if (rpc === undefined) return []
  try {
    const result = await rpc.call(ANTIGRAVITY_CATALOG_CHANNEL, ANTIGRAVITY_CATALOG_ENDPOINT, {}, undefined)
    return result.ok ? decodeAntigravityCatalogGroups(result.value) : []
  } catch {
    return []
  }
}

/** Overlay Enabled-catalog groups onto the Host catalog without duplicating ids. */
export function withAntigravityCatalog(base: readonly ModelProviderGroup[], extra: readonly ModelProviderGroup[]): ModelProviderGroup[] {
  return mergePickerGroups(base, extra)
}

interface RoleDirectory {
  roleOf(key: string): unknown
}

/** Read one Provider role from the owner directory; undefined when the seam is absent. */
export function readProviderRole(directory: unknown, key: string): string | undefined {
  if (directory === null || (typeof directory !== 'object' && typeof directory !== 'function')) return undefined
  const roleOf = (directory as Partial<RoleDirectory>).roleOf
  if (typeof roleOf !== 'function') return undefined
  const role = (roleOf as (key: string) => unknown).call(directory, key)
  return typeof role === 'string' ? role : undefined
}

/** Whether a ProviderDirectory-owned role marks an Agent provider. */
export function isAgentRole(role: string | undefined): boolean {
  return role === AGENT_ROLE
}
