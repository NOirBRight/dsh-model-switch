export type ClientContext = import('@deepseek-ai/cordis').Context & Record<string, any>;
export interface SettingsScopeSnapshot<T> {
    status: 'loading' | 'ready' | 'unavailable';
    value: T | undefined;
    base: unknown;
    user: unknown;
    revision: number | undefined;
    writable: boolean;
    mode: 'host' | 'memory';
}
export interface SettingsScope<T> {
    getSnapshot(): SettingsScopeSnapshot<T>;
    subscribe(listener: () => void): () => void;
    set(field: string, value: unknown): Promise<void>;
    unset(field: string): Promise<void>;
}
export type PendingWait<K extends string> = import('@deepseek-ai/dsh-client-runtime/client').PendingWait<K & keyof import('@deepseek-ai/dsh-client-runtime/client').PendingPayloads>;
