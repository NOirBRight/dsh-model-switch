import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'
import type { ModelSwitchAdapterRegistry } from './adapter-registry.js'
import type { RuntimeCapabilities } from './runtime-capabilities.js'

export const CAPABILITIES_CHANNEL = '/model-switch'
export interface CapabilitiesSnapshot { readonly revision: number; readonly capabilities: RuntimeCapabilities }

/** Bounded long-poll on the existing registry; each caller owns and disposes its subscription. */
export function capabilitiesRpc(registry: ModelSwitchAdapterRegistry, snapshot: () => RuntimeCapabilities, lifetime: AbortSignal): ConnectionRpcHandler {
  let revision = 0
  let previous: string | undefined
  const read = (): CapabilitiesSnapshot => {
    const capabilities = snapshot()
    const signature = JSON.stringify(capabilities)
    if (previous !== undefined && signature !== previous) revision++
    previous = signature
    return { revision, capabilities }
  }
  return async (endpoint, payload, signal) => {
    if (endpoint !== 'capabilities') return { ok: false, error: { details: {}, code: 'unknown-endpoint', message: 'Unknown Model Switch endpoint' } }
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload) || Object.keys(payload).some(key => key !== 'revision')) return { ok: false, error: { details: {}, code: 'invalid-request', message: 'Expected optional revision' } }
    const requested = (payload as { revision?: unknown }).revision
    if (requested !== undefined && (typeof requested !== 'number' || !Number.isSafeInteger(requested) || requested < 0)) return { ok: false, error: { details: {}, code: 'invalid-request', message: 'Invalid capabilities revision' } }
    if (requested === read().revision && !lifetime.aborted && !signal.aborted) await new Promise<void>(resolve => {
      const finish = (): void => { clearTimeout(timer); unsubscribe(); signal.removeEventListener('abort', finish); lifetime.removeEventListener('abort', finish); resolve() }
      const unsubscribe = registry.subscribe(finish)
      // ponytail: unary Connection has no browser stream; bounded long-poll until a public stream fits.
      const timer = setTimeout(finish, 20_000)
      signal.addEventListener('abort', finish, { once: true })
      lifetime.addEventListener('abort', finish, { once: true })
    })
    if (lifetime.aborted || signal.aborted) return { ok: false, error: { details: {}, code: 'cancelled', message: 'Capabilities subscription closed' } }
    return { ok: true, value: read() }
  }
}

export function installCapabilitiesRpc(ctx: Context, registry: ModelSwitchAdapterRegistry, snapshot: () => RuntimeCapabilities): void {
  ctx.inject(['connection'], scope => scope.effect(() => {
    const lifetime = new AbortController()
    const dispose = scope.connection.rpc.handle(CAPABILITIES_CHANNEL, capabilitiesRpc(registry, snapshot, lifetime.signal))
    return async () => { lifetime.abort(); await dispose() }
  }, 'Model Switch: lifecycle-owned search capability metadata'))
}
