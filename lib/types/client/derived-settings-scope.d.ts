import type { SettingsScope } from './shim.ts';
export type SettingsFieldMap<View> = Readonly<Partial<Record<keyof View & string, string>>>;
/** Projection over one shared SettingsScope controller/store, with explicit view-to-owner field mapping. */
export declare function deriveSettingsScope<Source, View>(source: SettingsScope<Source>, project: (value: Source) => View, fields?: SettingsFieldMap<View>): SettingsScope<View>;
