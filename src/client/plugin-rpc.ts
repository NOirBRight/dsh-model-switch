export interface PluginRpcClient {
  call(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<{ ok: boolean; value?: unknown }>
}

export function callPluginRpc(
  rpc: PluginRpcClient,
  method: string,
  endpoint: string,
  payload: unknown,
  signal?: AbortSignal,
): Promise<{ ok: boolean; value?: unknown }> {
  return rpc.call('/api', method, { endpoint, payload }, signal)
}
