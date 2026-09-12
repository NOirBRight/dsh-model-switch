/** Session execution-runtime lock from native binding and request activity. */

import { ANTIGRAVITY_PROVIDER_KEY } from './antigravity-catalog.ts'

/**
 * Antigravity activity RPC seam (dsh-acp-antigravity activity-contract).
 * Kept as literals: the Antigravity plugin is not a Model Switch dependency.
 */
export const ANTIGRAVITY_BINDING_CHANNEL = '/dsh-acp-antigravity'
export const ANTIGRAVITY_BINDING_ENDPOINT = 'activity/binding'

export type RuntimeProviderLock = typeof ANTIGRAVITY_PROVIDER_KEY | null

/** Lock read result: the bound provider, plus whether the read itself failed. */
export interface ProviderLockState {
  readonly provider: RuntimeProviderLock
  readonly failed: boolean
}

interface BindingRpc {
  call(channel: string, endpoint: string, payload: unknown, extra: undefined): Promise<{ ok: boolean; value?: unknown }>
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

/**
 * Decode one activity/binding reply. null means unbound; anything else shaped
 * is a read error (never thrown: the picker stays authoritative on failure).
 */
export function decodeBindingProvider(value: unknown): RuntimeProviderLock | undefined {
  const reply = record(value)
  if (reply === undefined) return undefined
  if (reply.provider === null) return null
  return reply.provider === ANTIGRAVITY_PROVIDER_KEY ? ANTIGRAVITY_PROVIDER_KEY : undefined
}

/**
 * Read one session native binding; undefined when the plugin is absent,
 * unreachable, or malformed. Never throws.
 */
export async function fetchSessionBinding(
  rpc: BindingRpc | undefined,
  sessionId: string,
): Promise<RuntimeProviderLock | undefined> {
  if (rpc === undefined) return undefined
  try {
    const result = await rpc.call(ANTIGRAVITY_BINDING_CHANNEL, ANTIGRAVITY_BINDING_ENDPOINT, { sessionId }, undefined)
    return result.ok ? decodeBindingProvider(result.value) : undefined
  } catch {
    return undefined
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
 * Fail closed for native-bound sessions (known lock, or current Antigravity
 * selection with no successful read yet): only the anchor stays selectable.
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
  const lock = effectiveProviderLock(state, currentProvider, context.active)
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
): RuntimeProviderLock {
  if (active && currentProvider === ANTIGRAVITY_PROVIDER_KEY) return ANTIGRAVITY_PROVIDER_KEY
  if (!state.failed) return state.provider
  if (state.provider === ANTIGRAVITY_PROVIDER_KEY || currentProvider === ANTIGRAVITY_PROVIDER_KEY) {
    return ANTIGRAVITY_PROVIDER_KEY
  }
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
