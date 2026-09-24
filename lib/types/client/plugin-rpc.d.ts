export interface PluginRpcClient {
    call(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<{
        ok: boolean;
        value?: unknown;
    }>;
}
export declare function callPluginRpc(rpc: PluginRpcClient, method: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<{
    ok: boolean;
    value?: unknown;
}>;
