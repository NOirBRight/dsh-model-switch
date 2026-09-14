/** Optional ProviderDirectory operations consumed by Model Switch. */

import { applySavedOrder, sortCatalogGroups } from 'dsh-llm-providers-ui/order'
import type { NativeBindingSource } from './runtime-lock.ts'

/** Provider-directory operations that may be supplied by the Providers UI plugin. */
export interface ProviderDirectoryFace {
  subscribe(listener: () => void): () => void
  roleOf?(key: string): string | undefined
  catalogRoutes?(): Readonly<Record<string, string>>
  nativeBindings?(): readonly NativeBindingSource[]
}

/** Read the optional catalog route map without assuming a particular Providers UI release. */
export function readCatalogRoutes(directory: ProviderDirectoryFace | undefined): Readonly<Record<string, string>> {
  const catalogRoutes = directory?.catalogRoutes
  return typeof catalogRoutes === 'function' ? catalogRoutes.call(directory) : {}
}

/** Read the optional native-binding declarations without assuming a particular Providers UI release. */
export function readNativeBindings(directory: ProviderDirectoryFace | undefined): readonly NativeBindingSource[] {
  const nativeBindings = directory?.nativeBindings
  return typeof nativeBindings === 'function' ? nativeBindings.call(directory) : []
}

function ownCatalogKey(catalogKeys: Readonly<Record<string, string>>, id: string): string | undefined {
  return Object.hasOwn(catalogKeys, id) ? catalogKeys[id] : undefined
}

/**
 * Rank picker/catalog groups from live ProviderDirectory routes.
 * Published 0.2.8 `sortCatalogGroups` only understands hardcoded LLM routes and
 * ignores a third argument, so Agent catalog ids would keep source order.
 * When the Owner publishes `catalogRoutes`, this ranks those keys locally.
 * With no live map, fall back to the compile-pinned 0.2.8 LLM-only sort.
 */
export function sortCatalogGroupsWithRoutes<T extends { id: string }>(
  groups: readonly T[],
  saved: readonly string[] = [],
  catalogKeys: Readonly<Record<string, string>> = {},
): T[] {
  const live = Object.entries(catalogKeys).filter(([id, key]) => Object.hasOwn(catalogKeys, id) && key.length > 0)
  if (live.length === 0) return sortCatalogGroups(groups, saved)
  if (saved.length === 0) return [...groups]
  const idByKey = new Map<string, string>()
  for (const [id, key] of live) idByKey.set(key, id)
  const ranked = applySavedOrder(
    groups.map(group => ownCatalogKey(catalogKeys, group.id)).filter((key): key is string => key !== undefined),
    saved,
  )
  const rank = new Map(ranked.flatMap((key, index) => {
    const route = idByKey.get(key)
    return route === undefined ? [] : [[route, index] as const]
  }))
  const known: T[] = []
  const unknown: T[] = []
  for (const group of groups) {
    if (rank.has(group.id)) known.push(group)
    else unknown.push(group)
  }
  known.sort((left, right) => (rank.get(left.id) ?? 0) - (rank.get(right.id) ?? 0))
  return [...known, ...unknown]
}
