/**
 * Composer model seat + Plan Review execution picker.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
export type { ContinueInDshOwner, PlanExternalAgentTarget } from './ContinueInDshAdapter.tsx';
import { type PickerKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        'composer-picker': PickerKey;
    }
}
/** Register composer model picker and Plan Review execution picker. */
export declare function installComposerPicker(ctx: ClientContext): void;
