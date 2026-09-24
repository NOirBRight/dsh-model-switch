/**
 * Composer model seat + Plan Review execution picker.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client';
import type { ProviderOrderSettings } from 'dsh-llm-providers-ui/order';
import { type PickerKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        'composer-picker': PickerKey;
    }
}
/**
 * Bind the optional Providers entry order as a React external store.
 * @returns A subscribable order snapshot with an invalidation hook for directory changes.
 */
export declare function providerOrderStore(form: ConfigForm<ProviderOrderSettings>): {
    subscribe: (listener: () => void) => () => void;
    getSnapshot: () => readonly string[];
    invalidate: () => void;
};
/** Register composer model picker and Plan Review execution picker. */
export declare function installComposerPicker(ctx: ClientContext): void;
