/**
 * Composer model seat + Plan Review execution picker.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { type PickerKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        'composer-picker': PickerKey;
    }
}
/**
 * Bind the optional Providers page order as a React external store.
 * @param settingsScope - Settings registry that may expose the Providers order namespace.
 * @returns A subscribable order snapshot with an invalidation hook for directory changes.
 */
export declare function providerOrderStore(settingsScope: {
    bind(options: {
        namespace: string;
        decode: (value: unknown) => {
            order: string[];
        };
    }): {
        getSnapshot(): {
            value?: {
                order: string[];
            } | undefined;
        };
        subscribe(listener: () => void): () => void;
    };
}): {
    subscribe: (listener: () => void) => () => void;
    getSnapshot: () => readonly string[];
    invalidate: () => void;
};
/** Register composer model picker and Plan Review execution picker. */
export declare function installComposerPicker(ctx: ClientContext): void;
