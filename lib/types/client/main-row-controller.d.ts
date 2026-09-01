import type { ModelProviderGroup } from '@deepseek-ai/dsh-api-session-controller/types';
import type { SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client';
import { type CapabilityRouteView, type MainSettingsView, type SubagentSettingsView } from '../client-contract.js';
import type { ModelSwitchLocaleKey } from './locales.js';
type Share<T> = (selector: (snapshot: SettingsScopeSnapshot<T>) => SettingsScopeSnapshot<T>) => SettingsScopeSnapshot<T>;
export interface SettingsControllerInputs {
    useMainSettings: Share<MainSettingsView>;
    useSubagentSettings: Share<SubagentSettingsView>;
    saveMain(next: MainSettingsView, expectedRevision: number): Promise<number>;
    loadCatalog(): Promise<readonly ModelProviderGroup[]>;
    subscribeProviderOrder?: (listener: () => void) => () => void;
    t(key: ModelSwitchLocaleKey): string;
}
export interface Choice {
    id: string;
    name: string;
    unavailable?: true;
}
/** Build a settings route for a newly selected model using only that model's default effort. */
export declare function selectRouteModel(groups: readonly ModelProviderGroup[], provider: string, model: string): MainSettingsView;
export declare function deriveRouteChoices(groups: readonly ModelProviderGroup[], route: CapabilityRouteView | undefined, allowedProviders?: readonly string[]): {
    providers: Choice[];
    models: Choice[];
};
export declare function expectedMainRevision(mirror: number, accepted?: number): number;
export declare function acceptedRevisionAfterFailure(accepted: number | undefined, error: unknown): number | undefined;
export declare function deriveMainChoices(groups: readonly ModelProviderGroup[], draft?: MainSettingsView): {
    providers: Choice[];
    models: Choice[];
    efforts: Choice[];
};
export declare function useModelSwitchSettingsController(input: SettingsControllerInputs): {
    main: SettingsScopeSnapshot<MainSettingsView>;
    subagent: SettingsScopeSnapshot<SubagentSettingsView>;
    draft: MainSettingsView | undefined;
    groups: readonly ModelProviderGroup[];
    providers: Choice[];
    models: Choice[];
    efforts: Choice[];
    busy: boolean;
    message: string | undefined;
    disabled: boolean;
    setProvider: (provider: string) => void;
    setModel: (id: string) => void;
    setReasoningEffort: (value: string) => void;
    reset: () => void;
    save: () => Promise<void>;
};
export {};
