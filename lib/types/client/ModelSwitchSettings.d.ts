import { type ReactNode } from 'react';
import type { ModelProviderGroup } from '@deepseek-ai/dsh-api-remotes/client';
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client';
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { CapabilityRouteView, MainSettingsView, SubagentSettingsView } from '../client-contract.js';
import type { RuntimeCapabilities } from '../runtime-capabilities.js';
import type { ModelSwitchLocaleKey } from './locales.js';
export interface ModelSwitchSettingsFace {
    t: (key: ModelSwitchLocaleKey) => string;
    hooks: {
        mainSettings: SettingsScope<MainSettingsView>;
        subagentSettings: SettingsScope<SubagentSettingsView>;
        searchSettings: SettingsScope<CapabilityRouteView>;
        imageSettings: SettingsScope<CapabilityRouteView>;
    };
    capabilities: RuntimeCapabilities;
    saveMain: (next: MainSettingsView, expectedRevision: number) => Promise<number>;
    setSubagent: (field: 'mode' | 'provider' | 'model', value: string | undefined) => Promise<void>;
    setCapability: (route: 'search' | 'image', field: 'provider' | 'model', value: string | undefined) => Promise<void>;
    loadCatalog: () => Promise<readonly ModelProviderGroup[]>;
}
export type ModelSwitchSettingsProps = PropsRuntime<'settings.section'> & InjectFace<ModelSwitchSettingsFace>;
export declare function ModelSwitchSettings(props: ModelSwitchSettingsProps): ReactNode;
