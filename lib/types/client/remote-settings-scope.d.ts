import type { SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client';
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client';
interface RemoteError {
    code: string;
    message: string;
}
interface RemoteResult<T> {
    ok: boolean;
    value?: T;
    error?: RemoteError;
}
interface NamespaceView {
    ns: string;
    value: unknown;
    base?: unknown;
    user?: unknown;
    revision: number;
}
interface DescribeValue {
    writable: boolean;
    namespaces: readonly NamespaceView[];
}
export interface RemoteSettingsFace {
    describe(): Promise<RemoteResult<DescribeValue>>;
    mutate(ns: string, ops: readonly unknown[], expectedRevision: number | undefined): Promise<RemoteResult<NamespaceView>>;
}
/** Host-backed settings scope used by this plugin on authenticated remote browsers. */
export declare class RemoteSettingsScope<T> implements SettingsScope<T> {
    private readonly api;
    private readonly namespace;
    private readonly decode;
    private snapshot;
    private readonly listeners;
    constructor(api: RemoteSettingsFace, namespace: string, decode: (value: unknown) => T | undefined);
    getSnapshot: () => SettingsScopeSnapshot<T>;
    subscribe: (listener: () => void) => (() => void);
    reload(): Promise<void>;
    set(field: string, value: unknown): Promise<void>;
    unset(field: string): Promise<void>;
    mutate(ops: readonly SettingsPathOpView[], expectedRevision?: number): Promise<void>;
    private write;
    private accept;
    private publish;
}
export {};
