import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-runtime/client'

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
  return {
    getSnapshot,
    subscribe: (listener) => source.subscribe(listener),
    set: (field, value) => source.set(ownerField(field), value),
    unset: (field) => source.unset(ownerField(field)),
  }
}
