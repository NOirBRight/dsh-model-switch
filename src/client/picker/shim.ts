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
// PendingWait moves to ui-conversation in alpha.1; rc.2 ships it on the
// removed client-runtime. The devDep graph is rc.2, so the structural class
// type comes from there; at runtime the browser object is the alpha.1 class,
// and the picker only narrows `kind`.
export type PendingWait<K extends string> = import('@deepseek-ai/dsh-client-runtime/client').PendingWait<K & keyof import('@deepseek-ai/dsh-client-runtime/client').PendingPayloads>
