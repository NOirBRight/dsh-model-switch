import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type ModelSwitchLocaleKey } from './locales.js';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        'settings.model-switch': ModelSwitchLocaleKey;
    }
}
export declare const name = "dsh-model-switch-client";
export declare const inject: string[];
export declare function apply(ctx: ClientContext): void;
