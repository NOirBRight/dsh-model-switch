import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client';
export interface ConfigViewForm<T> {
    getSnapshot(): ConfigFormSnapshot<T>;
    subscribe(listener: () => void): () => void;
    set(field: keyof T & string, value: unknown): Promise<void>;
    unset(field: keyof T & string): Promise<void>;
}
export declare function deriveConfigForm<Source, View>(source: ConfigForm<Source>, project: (value: Source) => View, fields: {
    [K in keyof View & string]: keyof Source & string;
}): ConfigViewForm<View>;
