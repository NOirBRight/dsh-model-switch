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

/** Retain supported effort choices from the remote catalog. */
function decodeReasoning(value: unknown): { efforts: { id: string; name: string }[]; defaultEffort: string } | undefined {
  const item = record(value)
  if (item === undefined || !Array.isArray(item.efforts)) return undefined
  const efforts: { id: string; name: string }[] = []
  for (const entry of item.efforts) {
    const effort = record(entry)
    if (effort === undefined || typeof effort.id !== 'string' || typeof effort.name !== 'string') continue
    efforts.push({ id: effort.id, name: effort.name })
  }
  if (efforts.length === 0) return undefined
  const defaultEffort = typeof item.defaultEffort === 'string' && efforts.some(effort => effort.id === item.defaultEffort) ? item.defaultEffort : efforts[0]!.id
  return { efforts, defaultEffort }
}

const NATIVE_EFFORTS = ['high', 'medium', 'low'] as const

// Native suffix rules mirror dsh-acp-antigravity/src/catalog.ts; update both together.
function collapseNativeEfforts(models: ModelProviderGroup['models'][number][]): ModelProviderGroup['models'][number][] {
  if (models.some(model => model.reasoning !== undefined)) return models
  const groups = new Map<string, { name: string; efforts: string[] }>()
  const order: string[] = []
  for (const model of models) {
    let logical = model.id
    let effort: string | undefined
    for (const item of NATIVE_EFFORTS) {
      const suffix = '-' + item
      if (model.id.endsWith(suffix) && model.id.length > suffix.length) { logical = model.id.slice(0, -suffix.length); effort = item; break }
    }
    let group = groups.get(logical)
    if (group === undefined) {
      let name = model.name
      for (const label of [' (High)', ' (Medium)', ' (Low)']) if (name.endsWith(label)) name = name.slice(0, -label.length)
      group = { name, efforts: [] }
      groups.set(logical, group)
      order.push(logical)
    }
    if (effort !== undefined && !group.efforts.includes(effort)) group.efforts.push(effort)
    if (effort === undefined) group.name = model.name
  }
  return order.map(id => {
    const group = groups.get(id)!
    const efforts = NATIVE_EFFORTS.filter(item => group.efforts.includes(item)).map(item => ({ id: item, name: item[0]!.toUpperCase() + item.slice(1) }))
    return { id, name: group.name, ...(efforts.length === 0 ? {} : { reasoning: { efforts, defaultEffort: group.efforts.includes('high') ? 'high' : efforts[0]!.id } }) }
  })
}

/** Strictly decode one Enabled-catalog group; malformed groups are dropped, never thrown. */
function decodeGroup(value: unknown): ModelProviderGroup | undefined {
  const group = record(value)
  if (group === undefined || typeof group.id !== 'string' || typeof group.name !== 'string' || !Array.isArray(group.models)) return undefined
  const models: ModelProviderGroup['models'][number][] = []
  for (const item of group.models) {
    const model = record(item)
    if (model === undefined || typeof model.id !== 'string' || typeof model.name !== 'string') continue
    const reasoning = decodeReasoning(model.reasoning)
    models.push({ id: model.id, name: model.name, ...(reasoning === undefined ? {} : { reasoning }) })
  }
  if (models.length === 0) return undefined
  return { id: group.id, name: group.name, models: collapseNativeEfforts(models) }
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

/** Resolve a stored native `…-high|medium|low` id to the collapsed catalog row. */
export function matchCatalogModel(models: readonly ModelProviderGroup['models'][number][], modelId: string | undefined): { model: ModelProviderGroup['models'][number]; effort?: string } | undefined {
  if (modelId === undefined) return undefined
  const exact = models.find(model => model.id === modelId)
  if (exact !== undefined) return { model: exact }
  for (const effort of NATIVE_EFFORTS) {
    const suffix = '-' + effort
    if (!modelId.endsWith(suffix) || modelId.length <= suffix.length) continue
    const logical = models.find(model => model.id === modelId.slice(0, -suffix.length))
    if (logical?.reasoning?.efforts.some(option => option.id === effort)) return { model: logical, effort }
  }
  return undefined
}
