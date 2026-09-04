import type { ModelSelection } from '@deepseek-ai/dsh-api-session-controller/types'
import type { PickerDirectorySnapshot, PickerDirectoryStore } from './PickerDirectory.ts'

type CatalogGroup = PickerDirectorySnapshot['groups'][number]

/** Overlay groups from External Agent catalog onto the LLM session.models snapshot. */
export function mergePickerGroups(base: readonly CatalogGroup[], extra: readonly CatalogGroup[]): CatalogGroup[] {
  const ids = new Set(extra.map(group => group.id))
  return [...base.filter(group => !ids.has(group.id)), ...extra]
}

export function overlayPickerSnapshot(base: PickerDirectorySnapshot, extra: readonly CatalogGroup[], current: ModelSelection | null): PickerDirectorySnapshot {
  const groups = mergePickerGroups(base.groups, extra)
  return { ...base, groups, current: current ?? base.current }
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
  const listeners = new Set<() => void>()
  const notify = (): void => { for (const listener of listeners) listener() }
  return {
    store: {
      subscribe: listener => {
        listeners.add(listener)
        const dispose = base.subscribe(listener)
        return () => { listeners.delete(listener); dispose() }
      },
      getSnapshot: () => overlayPickerSnapshot(base.getSnapshot(), extra, current),
    },
    setExtra: groups => { extra = groups; notify() },
    setCurrent: next => { current = next; notify() },
    extraIds: () => new Set(extra.map(group => group.id)),
  }
}
