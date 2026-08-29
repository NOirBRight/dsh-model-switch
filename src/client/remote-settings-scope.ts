import type { SettingsScope, SettingsScopeSnapshot } from './shim.js'

interface RemoteError { code: string; message: string }
interface RemoteResult<T> { ok: boolean; value?: T; error?: RemoteError }
interface NamespaceView {
  ns: string
  value: unknown
  base?: unknown
  user?: unknown
  revision: number
}
interface DescribeValue { writable: boolean; namespaces: readonly NamespaceView[] }
export interface RemoteSettingsFace {
  describe(): Promise<RemoteResult<DescribeValue>>
  mutate(ns: string, ops: readonly unknown[], expectedRevision: number | undefined): Promise<RemoteResult<NamespaceView>>
}

/** Host-backed settings scope used by this plugin on authenticated remote browsers. */
export class RemoteSettingsScope<T> implements SettingsScope<T> {
  private snapshot: SettingsScopeSnapshot<T> = {
    status: 'loading', value: undefined, base: undefined, user: undefined,
    revision: undefined, writable: false, mode: 'host',
  }
  private readonly listeners = new Set<() => void>()

  constructor(
    private readonly api: RemoteSettingsFace,
    private readonly namespace: string,
    private readonly decode: (value: unknown) => T | undefined,
  ) {}

  getSnapshot = (): SettingsScopeSnapshot<T> => this.snapshot
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }

  async reload(): Promise<void> {
    try {
      const result = await this.api.describe()
      if (!result.ok || result.value === undefined) throw new Error(result.error?.message ?? 'settings unavailable')
      const view = result.value.namespaces.find(item => item.ns === this.namespace)
      if (view === undefined) throw new Error('settings namespace unavailable')
      const value = this.decode(view.value)
      if (value === undefined) throw new Error('settings namespace is invalid')
      this.accept(view, value, result.value.writable)
    } catch {
      this.snapshot = { ...this.snapshot, status: 'unavailable', writable: false }
      this.publish()
    }
  }

  set(field: string, value: unknown): Promise<void> {
    return this.write([{ op: 'set', path: [field], value }])
  }
  unset(field: string): Promise<void> {
    return this.write([{ op: 'unset', path: [field] }])
  }

  private async write(ops: readonly unknown[]): Promise<void> {
    const result = await this.api.mutate(this.namespace, ops, this.snapshot.revision)
    if (!result.ok || result.value === undefined) throw new Error((result.error?.code ?? 'settings-error') + ': ' + (result.error?.message ?? ''))
    const value = this.decode(result.value.value)
    if (value === undefined) throw new Error('settings namespace is invalid')
    this.accept(result.value, value, this.snapshot.writable)
  }

  private accept(view: NamespaceView, value: T, writable: boolean): void {
    this.snapshot = {
      status: 'ready', value, base: view.base, user: view.user,
      revision: view.revision, writable, mode: 'host',
    }
    this.publish()
  }
  private publish(): void { for (const listener of this.listeners) listener() }
}
