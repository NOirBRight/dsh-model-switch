import type { SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'

export type SettingsFieldMap<View> = Readonly<Partial<Record<keyof View & string, string>>>

/** Projection over one shared SettingsScope controller/store, with explicit view-to-owner field mapping. */
export function deriveSettingsScope<Source, View>(source: SettingsScope<Source>, project: (value: Source) => View, fields: SettingsFieldMap<View> = {} as SettingsFieldMap<View>): SettingsScope<View> {
  let previousSource: SettingsScopeSnapshot<Source> | undefined
  let previousView: SettingsScopeSnapshot<View> | undefined
  const getSnapshot = (): SettingsScopeSnapshot<View> => {
    const snapshot = source.getSnapshot()
    if (snapshot === previousSource && previousView !== undefined) return previousView
    previousSource = snapshot
    previousView = { ...snapshot, value: snapshot.value === undefined ? undefined : project(snapshot.value) }
    return previousView
  }
  const ownerField = (field: string): string => fields[field as keyof View & string] ?? field
  const mapOperations = (ops: readonly SettingsPathOpView[]): SettingsPathOpView[] => ops.map(operation => ({
    ...operation,
    path: operation.path.map((part, index) => index === 0 ? ownerField(part) : part),
  }))
  return {
    getSnapshot,
    subscribe: (listener) => source.subscribe(listener),
    mutate: (ops, expectedRevision) => source.mutate(mapOperations(ops), expectedRevision),
    set: (field, value) => source.set(ownerField(field), value),
    unset: (field) => source.unset(ownerField(field)),
  }
}
