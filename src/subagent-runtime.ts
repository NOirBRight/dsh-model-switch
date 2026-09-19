import { Context } from '@deepseek-ai/cordis'
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { AgentOptions, ModelSelection } from '@deepseek-ai/dsh-agent'
import OfficialSubagentRuntime, {
  type ContinuableStart,
  type ContinuableStartSpec,
  type SubagentRun,
  type SubagentStartRequest,
} from '@deepseek-ai/dsh-subagent'
import type { Config } from './host-settings.js'

/** Raised only when an explicit startup check finds an unsupported public surface. */
export class StartupIncompatibilityError extends Error {
  override readonly name = 'StartupIncompatibilityError'
  readonly surface: string

  /**
   * @param surfaceOrMessage - the incompatible public surface, or the error message.
   * @param message - the missing or incompatible requirement.
   */
  constructor(surfaceOrMessage: string, message?: string) {
    super(message ?? surfaceOrMessage)
    this.surface = message === undefined ? 'startup' : surfaceOrMessage
  }
}

/** One idempotent cleanup operation tracked during runtime startup. */
export type StartupDisposer = () => void | PromiseLike<void>

/** Register one cleanup operation for a startup attempt. */
export type StartupCleanupTracker = (dispose: StartupDisposer) => void

/** A successfully mounted runtime and its idempotent cleanup operation. */
export interface MountedStartup<T> {
  readonly value: T
  readonly dispose: () => Promise<void>
}

interface ModelSwitchSurface {
  currentSettings(): Config
}
type RoutableSubagentRequest = Pick<SubagentStartRequest, 'parent' | 'agentOptions'>

interface ProfileContext {
  readonly modelSwitch?: unknown
  readonly subagents?: unknown
}

function present(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

function spawnHasAnyRouteField(options: AgentOptions | undefined): boolean {
  return present(options?.provider) || present(options?.model) || options?.reasoningEffort !== undefined
}

function fixedRoute(settings: Config): ModelSelection | undefined {
  if (!present(settings.subagentProvider) || !present(settings.subagentModel)) return undefined
  return {
    provider: settings.subagentProvider,
    model: settings.subagentModel,
    ...(present(settings.subagentReasoningEffort) ? { reasoningEffort: ReasoningEffortId(settings.subagentReasoningEffort) } : {}),
  }
}

/** Inject a fixed Default Subagent route, or leave the request for Official inherit. */
export function routeSubagentRequest<T extends RoutableSubagentRequest>(
  request: T,
  settings: Config,
): T {
  if (spawnHasAnyRouteField(request.agentOptions)) return request
  if (settings.subagentMode !== 'fixed') return request
  const selected = fixedRoute(settings)
  if (selected === undefined) return request
  return {
    ...request,
    agentOptions: {
      ...request.agentOptions,
      provider: selected.provider,
      model: selected.model,
      ...(selected.reasoningEffort === undefined ? {} : { reasoningEffort: selected.reasoningEffort }),
    },
  }
}

function assertPublicMethod(value: unknown, surface: string, method: string): void {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function') || typeof Reflect.get(value, method) !== 'function') {
    throw new StartupIncompatibilityError(surface, surface + ' must expose public ' + method + '()')
  }
}

function constructible(value: unknown): value is Function {
  if (typeof value !== 'function') return false
  try {
    Reflect.construct(Object, [], value)
    return true
  } catch (error) {
    if (error instanceof TypeError) return false
    throw error
  }
}

function assertOfficialRuntimeSurface(): void {
  const runtime = OfficialSubagentRuntime as unknown
  if (!constructible(runtime)) {
    throw new StartupIncompatibilityError('OfficialSubagentRuntime', 'OfficialSubagentRuntime must be constructible')
  }
  const prototype = Reflect.get(runtime, 'prototype')
  assertPublicMethod(prototype, 'OfficialSubagentRuntime', 'start')
  assertPublicMethod(prototype, 'OfficialSubagentRuntime', 'startContinuable')
}

function assertRoutingSurface(ctx: Context): void {
  const modelSwitch = (ctx as ProfileContext).modelSwitch
  assertPublicMethod(modelSwitch, 'Model Switch runtime', 'currentSettings')
}

function routingSurface(ctx: Context): ModelSwitchSurface {
  return (ctx as ProfileContext).modelSwitch as ModelSwitchSurface
}

function assertMountedSurface(ctx: Context): void {
  assertPublicMethod((ctx as ProfileContext).subagents, 'mounted Subagent runtime', 'start')
  assertPublicMethod((ctx as ProfileContext).subagents, 'mounted Subagent runtime', 'startContinuable')
}

function once(dispose: StartupDisposer): () => Promise<void> {
  let pending: Promise<void> | undefined
  return () => {
    pending ??= Promise.resolve().then(() => dispose()).then(() => undefined)
    return pending
  }
}

class CleanupLedger {
  private readonly attempts: (() => Promise<void>)[] = []

  add(dispose: StartupDisposer): void {
    this.attempts.push(once(dispose))
  }

  async disposeAll(): Promise<unknown[]> {
    const failures: unknown[] = []
    for (const dispose of [...this.attempts].reverse()) {
      try {
        await dispose()
      } catch (error) {
        failures.push(error)
      }
    }
    return failures
  }
}

function startupFailure(error: unknown, cleanupFailures: readonly unknown[]): never {
  if (cleanupFailures.length === 0) throw error
  throw new AggregateError([error, ...cleanupFailures], 'Subagent runtime startup and cleanup failed', { cause: error })
}

function cleanupDisposer(ledger: CleanupLedger): () => Promise<void> {
  return async () => {
    const failures = await ledger.disposeAll()
    if (failures.length > 0) throw new AggregateError(failures, 'Subagent runtime cleanup failed')
  }
}

/**
 * Mount a candidate and use the fallback only for typed startup incompatibility.
 *
 * Every resource registered by an attempt is disposed in reverse order before a
 * fallback starts and again when the mounted result is disposed. Cleanup keeps
 * running after failures, and a startup error stays first in any aggregate.
 *
 * @param candidate - startup callback for the routed candidate.
 * @param fallback - startup callback for the untouched official runtime.
 * @returns the selected value and an idempotent disposer.
 * @throws the candidate error unless it is a StartupIncompatibilityError.
 * @throws the fallback startup error when fallback startup fails.
 */
export async function mountWithStartupFallback<T>(
  candidate: (track: StartupCleanupTracker) => Promise<T>,
  fallback: (track: StartupCleanupTracker) => Promise<T>,
): Promise<MountedStartup<T>> {
  const ledger = new CleanupLedger()
  try {
    const value = await candidate(dispose => ledger.add(dispose))
    return { value, dispose: cleanupDisposer(ledger) }
  } catch (error) {
    const cleanupFailures = await ledger.disposeAll()
    if (!(error instanceof StartupIncompatibilityError)) startupFailure(error, cleanupFailures)
    if (cleanupFailures.length > 0) startupFailure(error, cleanupFailures)
  }

  try {
    const value = await fallback(dispose => ledger.add(dispose))
    return { value, dispose: cleanupDisposer(ledger) }
  } catch (error) {
    startupFailure(error, await ledger.disposeAll())
  }
}

async function mountProfileRuntime(ctx: Context): Promise<() => Promise<void>> {
  const mounted = await mountWithStartupFallback(
    async track => {
      assertOfficialRuntimeSurface()
      assertRoutingSurface(ctx)
      const candidate = ctx.plugin(ModelSwitchSubagentRuntime)
      track(() => candidate.dispose())
      await candidate
      const surface = ctx.inject(['subagents'], (surfaceCtx: Context) => { assertMountedSurface(surfaceCtx) })
      track(() => surface.dispose())
      await surface
      return candidate
    },
    async track => {
      const official = ctx.plugin(OfficialSubagentRuntime)
      track(() => official.dispose())
      await official
      return official
    },
  )
  return mounted.dispose
}

/** Profile replacement that selects the routed runtime or the untouched official runtime. */
export const profileSubagentRuntime = Object.assign(
  async (ctx: Context): Promise<() => Promise<void>> => mountProfileRuntime(ctx),
  { inject: ['modelSwitch'] },
)

/** Official runtime with only a pre-descriptor route-selection adapter. */
export class ModelSwitchSubagentRuntime extends OfficialSubagentRuntime {
  static inject = ['modelSwitch']

  private routed<T extends RoutableSubagentRequest>(name: string, request: T): T {
    const provider = this.ctx.subagents.getProvider(name)
    // External Product Workers are one-shot process adapters. They do not
    // accept DSH Agent options, so Model Switch must not reinterpret them as
    // Native continuable Subagents or inject a provider/model route.
    if (provider !== undefined && provider.capabilities.agentOptions !== true) return request
    const modelSwitch = routingSurface(this.ctx)
    return routeSubagentRequest(request, modelSwitch.currentSettings())
  }

  override start(name: string, request: SubagentStartRequest): Promise<SubagentRun> {
    return super.start(name, this.routed(name, request))
  }

  override startContinuable(spec: ContinuableStartSpec): Promise<ContinuableStart> {
    return super.startContinuable({ ...spec, request: this.routed(spec.provider, spec.request) })
  }
}

export default profileSubagentRuntime
