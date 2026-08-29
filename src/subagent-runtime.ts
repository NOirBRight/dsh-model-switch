import { ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { AgentOptions, ModelSelection } from '@deepseek-ai/dsh-agent'
import OfficialSubagentRuntime, {
  type ContinuableStart,
  type ContinuableStartSpec,
  type SubagentRun,
  type SubagentStartRequest,
} from '@deepseek-ai/dsh-subagent'
import type { Config } from './host-settings.js'

export class SubagentRouteUnavailableError extends Error {
  override readonly name = 'SubagentRouteUnavailableError'
}

function present(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

/** AgentOptions gains `reasoningEffort` in 0.1.2-alpha.1; rc.2 lacks the field.
 *  This structural alias carries it without breaking the rc.2 devDep typecheck. */
type EffortCapableAgentOptions = AgentOptions & { reasoningEffort?: ReasoningEffortId }

function explicitRoute(options: AgentOptions | undefined): ModelSelection | undefined {
  const effortCapable = options as EffortCapableAgentOptions | undefined
  const provider = effortCapable?.provider
  const model = effortCapable?.model
  if (present(provider) && present(model)) {
    return {
      provider,
      model,
      ...(effortCapable?.reasoningEffort === undefined ? {} : { reasoningEffort: effortCapable.reasoningEffort }),
    }
  }
  if (present(provider) || present(model)) {
    throw new SubagentRouteUnavailableError('explicit Subagent routes require both provider and model')
  }
  return undefined
}

function providerModel(selection: ModelSelection, source: string): ModelSelection {
  if (!present(selection.provider) || !present(selection.model)) {
    throw new SubagentRouteUnavailableError(source + ' must provide non-empty provider and model')
  }
  return {
    provider: selection.provider,
    model: selection.model,
    ...(selection.reasoningEffort === undefined ? {} : { reasoningEffort: selection.reasoningEffort }),
  }
}

function fixedRoute(settings: Config): ModelSelection {
  if (!present(settings.subagentProvider) || !present(settings.subagentModel)) {
    throw new SubagentRouteUnavailableError('fixed Subagent policy requires non-empty subagentProvider and subagentModel')
  }
  return {
    provider: settings.subagentProvider,
    model: settings.subagentModel,
    ...(present(settings.subagentReasoningEffort) ? { reasoningEffort: ReasoningEffortId(settings.subagentReasoningEffort) } : {}),
  }
}

type RoutableSubagentRequest = Pick<SubagentStartRequest, 'parent' | 'agentOptions'>

function parentRoute(request: RoutableSubagentRequest): ModelSelection | undefined {
  const header = request.parent.session.requestHeader()?.config
  if (header !== undefined && present(header.provider) && present(header.model)) {
    return {
      provider: header.provider,
      model: header.model,
      ...(header.reasoningEffort === undefined ? {} : { reasoningEffort: header.reasoningEffort }),
    }
  }
  return explicitRoute(request.parent.options)
}

/** Resolve and snapshot the route that must exist before official descriptor creation. */
export function routeSubagentRequest<T extends RoutableSubagentRequest>(
  request: T,
  settings: Config,
  main: ModelSelection,
): T {
  if (explicitRoute(request.agentOptions) !== undefined) return request
  const fromParent = settings.subagentMode === 'follow-main' ? parentRoute(request) : undefined
  const selected = settings.subagentMode === 'fixed'
    ? fixedRoute(settings)
    : providerModel(fromParent ?? main, fromParent === undefined ? 'Main default' : 'parent route')
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

/** Official rc.2 runtime with only a pre-descriptor route-selection adapter. */
export class ModelSwitchSubagentRuntime extends OfficialSubagentRuntime {
  static inject = ['modelSwitch']

  private routed<T extends RoutableSubagentRequest>(request: T): T {
    return routeSubagentRequest(
      request,
      this.ctx.modelSwitch.currentSettings(),
      this.ctx.modelSwitch.currentMainSelection(),
    )
  }

  override start(name: string, request: SubagentStartRequest): Promise<SubagentRun> {
    return super.start(name, this.routed(request))
  }

  override startContinuable(spec: ContinuableStartSpec): Promise<ContinuableStart> {
    return super.startContinuable({ ...spec, request: this.routed(spec.request) })
  }
}

export default ModelSwitchSubagentRuntime
