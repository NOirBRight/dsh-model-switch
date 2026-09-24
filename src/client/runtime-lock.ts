import { callPluginRpc, type PluginRpcClient } from './plugin-rpc.ts'
/** Session execution-runtime lock from native binding and request activity. */

/** Native binding query declared by an installed Agent provider. */
export interface NativeBindingSource {
  readonly provider: string
  readonly channel: string
  readonly endpoint: string
}

export type RuntimeProviderLock = string | null

/** A known binding remains authoritative even if another query fails. */
export interface ProviderLockState {
  readonly provider: RuntimeProviderLock
  readonly failed: boolean
}


/** Decode a wire reply only for the provider that owns the query. */
export function decodeBindingProvider(value: unknown, provider: string): RuntimeProviderLock | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const reply = value as { provider?: unknown }
  return reply.provider === null || reply.provider === provider ? reply.provider : undefined
}

/** Query installed declarations; one failed query must never become a successful unbound read. */
export async function fetchSessionBinding(
  rpc: PluginRpcClient | undefined,
  sessionId: string,
  sources: readonly NativeBindingSource[],
): Promise<ProviderLockState> {
  if (sources.length === 0) return { provider: null, failed: false }
  if (rpc === undefined) return { provider: null, failed: true }
  const replies = await Promise.all(sources.map(async source => {
    try {
      const result = await callPluginRpc(rpc, source.channel, source.endpoint, { sessionId })
      return result.ok ? decodeBindingProvider(result.value, source.provider) : undefined
    } catch {
      return undefined // An unavailable binding query is not proof of an unbound session.
    }
  }))
  const bindings = new Set(replies.filter((value): value is string => typeof value === 'string'))
  return {
    provider: bindings.size === 1 ? [...bindings][0]! : null,
    failed: replies.includes(undefined) || bindings.size > 1,
  }
}

/** Whether one provider remains selectable under a known lock read. */
export function providerSelectable(lock: RuntimeProviderLock, provider: string): boolean {
  return lock === null || provider === lock
}

/** Extra facts for Agent-role selection on blank vs existing DSH sessions. */
export interface ProviderAllowContext {
  /** Empty-log bit from the conversation snapshot; omit when unknown. */
  blank?: boolean
  /** A prompt is being submitted, awaits its first turn, or is running. */
  active?: boolean
  /** Whether the candidate provider is an Agent-role External Agent. */
  agent?: boolean
  /** Whether the current selection is an Agent provider, from its declaration. */
  currentAgent?: boolean
}

/**
 * Existing DSH history cannot convert to an External Agent. Blank sessions
 * and already-bound native sessions keep their current Agent choice.
 */
export function agentProviderLocked(blank: boolean, bound: RuntimeProviderLock, active = false): boolean {
  return (blank === false || active) && bound === null
}

/** Picker allow-check over the already-effective lock and the agentLocked bit. */
export function runtimeChoiceAllowed(
  lock: RuntimeProviderLock,
  agentLocked: boolean,
  provider: string,
  currentProvider: string | undefined,
  agent: boolean,
): boolean {
  if (!providerSelectable(lock, provider)) return false
  if (agentLocked && agent) return provider === currentProvider
  return true
}

/**
 * Whether one provider remains selectable under a lock read that may have failed.
 * Failed reads keep only the known binding or current selection selectable;
 * active Agent selections reserve their runtime before the first binding arrives.
 * Unbound sessions with DSH history cannot select a new Agent provider.
 * Log reading is never gated by this.
 * @param state - Latest lock read for the session.
 * @param provider - Candidate provider for the pending selection.
 * @param currentProvider - Session current provider, if any.
 * @param context - Session history, request activity, and candidate Agent role.
 */
export function isProviderAllowed(
  state: ProviderLockState,
  provider: string,
  currentProvider: string | undefined,
  context: ProviderAllowContext = {},
): boolean {
  if (state.failed && provider !== (state.provider ?? currentProvider)) return false
  const lock = effectiveProviderLock(state, currentProvider, context.active, context.currentAgent)
  if (!providerSelectable(lock, provider)) return false
  if (context.agent === true && (context.blank === false || context.active === true) && lock === null) return provider === currentProvider
  return true
}

/**
 * Effective single-provider lock for pickers that only understand
 * RuntimeProviderLock. Errors fail closed exactly as isProviderAllowed does.
 */
export function effectiveProviderLock(
  state: ProviderLockState,
  currentProvider: string | undefined,
  active = false,
  currentAgent = false,
): RuntimeProviderLock {
  if (state.provider !== null) return state.provider
  if (state.failed || (active && currentAgent)) return currentProvider ?? null
  return null
}

/** Minimal shared lock state: one snapshot per session, refreshed on demand. */
export interface ProviderLockStore {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => ProviderLockState
  /** Re-read; concurrent reads resolve in call order, stale ones are dropped. */
  refresh: () => Promise<ProviderLockState>
}

/**
 * Create one session lock store over an injecting query.
 * The query sees the previous snapshot for sticky failure mapping and never
 * throws (failures resolve to failed reads); refresh never rejects.
 */
export function createProviderLockStore(query: (previous: ProviderLockState) => Promise<ProviderLockState>): ProviderLockStore {
  let current: ProviderLockState = { provider: null, failed: false }
  const listeners = new Set<() => void>()
  let generation = 0
  const emit = (): void => {
    for (const listener of [...listeners]) listener()
  }
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => current,
    refresh: async () => {
      const seen = ++generation
      const previous = current
      let next: ProviderLockState
      try {
        next = await query(previous)
      } catch {
        next = { provider: previous.provider, failed: true }
      }
      if (seen !== generation) return current
      if (next.provider !== current.provider || next.failed !== current.failed) {
        current = next
        emit()
      }
      return current
    },
  }
}
