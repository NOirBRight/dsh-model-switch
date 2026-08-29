/** Dual-version picker types shared by rc.2 and alpha.1. */
export type { ClientContext, SettingsScope, SettingsScopeSnapshot } from '../shim.ts';
/** Structural Plan wait used across rc.2 respond and alpha.1 answer/cancel. */
export interface PendingWait<K extends string> {
    readonly kind: K;
    readonly key: string;
    readonly sessionId: unknown;
    readonly payload?: {
        questions?: readonly unknown[];
    };
    readonly questions?: readonly unknown[];
    respond?(message: unknown): Promise<{
        accepted: boolean;
    }>;
    answer?(answer: unknown): Promise<void>;
    cancel?(): Promise<void>;
}
