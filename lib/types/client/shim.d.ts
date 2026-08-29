/** Dual-version client types after the monolithic runtime removal. */
export type { Context as ClientContext } from '@deepseek-ai/cordis';
/** Public Settings scope fields used by Model Switch on rc.2 and alpha.1. */
export interface SettingsScopeSnapshot<T> {
    status: 'loading' | 'ready' | 'unavailable';
    value: T | undefined;
    base: unknown;
    user: unknown;
    revision: number | undefined;
    writable: boolean;
    mode: 'host' | 'memory';
}
/** Minimal Settings controller surface consumed by this plugin. */
export interface SettingsScope<T> {
    getSnapshot(): SettingsScopeSnapshot<T>;
    subscribe(listener: () => void): () => void;
    set(field: string, value: unknown): Promise<void>;
    unset(field: string): Promise<void>;
}
