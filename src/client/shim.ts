// Alpha.1 type shim: the client Runtime package was removed upstream, so the
// card types the browser plugin needs come from Cordis Context plus the
// settings scope contract re-exported by ui-settings.
export type ClientContext = import('@deepseek-ai/cordis').Context & Record<string, any>
export interface SettingsScopeSnapshot<T> {
  status: 'loading' | 'ready' | 'unavailable'
  value: T | undefined
  base: unknown
  user: unknown
  revision: number | undefined
  writable: boolean
  mode: 'host' | 'memory'
}
export interface SettingsScope<T> {
  getSnapshot(): SettingsScopeSnapshot<T>
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<void>
  unset(field: string): Promise<void>
}
