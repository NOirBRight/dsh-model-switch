import type { ModelSelection } from '@deepseek-ai/dsh-api-session-controller/types'
import type { PickerDirectorySnapshot, PickerDirectoryStore } from './PickerDirectory.ts'

type CatalogGroup = PickerDirectorySnapshot['groups'][number]

/** Overlay groups from External Agent catalog onto the LLM session.models snapshot. */
export function mergePickerGroups(base: readonly CatalogGroup[], extra: readonly CatalogGroup[]): CatalogGroup[] {
  if (extra.length === 0) return base as CatalogGroup[]
  const ids = new Set(extra.map(group => group.id))
  return [...base.filter(group => !ids.has(group.id)), ...extra]
}

export function overlayPickerSnapshot(base: PickerDirectorySnapshot, extra: readonly CatalogGroup[], current: ModelSelection | null): PickerDirectorySnapshot {
  const groups = mergePickerGroups(base.groups, extra)
  const nextCurrent = current ?? base.current
  if (groups === base.groups && nextCurrent === base.current) return base
  return { ...base, groups, current: nextCurrent }
}

/** Subscribe-able overlay that hides unready External Agent groups by simply omitting them. */
export function createExternalCatalogStore(base: PickerDirectoryStore): {
  store: PickerDirectoryStore
  setExtra(groups: readonly CatalogGroup[]): void
  setCurrent(current: ModelSelection | null): void
  extraIds(): ReadonlySet<string>
} {
  let extra: readonly CatalogGroup[] = []
  let current: ModelSelection | null = null
  let lastBase: PickerDirectorySnapshot | undefined
  let lastExtra: readonly CatalogGroup[] = extra
  let lastCurrent: ModelSelection | null = current
  let lastSnapshot: PickerDirectorySnapshot | undefined
  const listeners = new Set<() => void>()
  const notify = (): void => { for (const listener of listeners) listener() }
  return {
    store: {
      subscribe: listener => {
        listeners.add(listener)
        const dispose = base.subscribe(listener)
        return () => { listeners.delete(listener); dispose() }
      },
      getSnapshot: () => {
        const next = base.getSnapshot()
        if (lastSnapshot !== undefined && lastBase === next && lastExtra === extra && lastCurrent === current) return lastSnapshot
        lastBase = next
        lastExtra = extra
        lastCurrent = current
        lastSnapshot = overlayPickerSnapshot(next, extra, current)
        return lastSnapshot
      },
    },
    setExtra: groups => {
      if (groups === extra || (groups.length === 0 && extra.length === 0)) return
      extra = groups
      lastSnapshot = undefined
      notify()
    },
    setCurrent: next => {
      if (next === current) return
      current = next
      lastSnapshot = undefined
      notify()
    },
    extraIds: () => new Set(extra.map(group => group.id)),
  }
}
