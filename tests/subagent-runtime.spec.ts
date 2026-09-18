import { describe, expect, it } from 'vitest'
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import { routeSubagentRequest, SubagentRouteUnavailableError } from '../src/subagent-runtime.js'

function request(agentOptions?: { provider?: string; model?: string; reasoningEffort?: ReturnType<typeof ReasoningEffortId> }) {
  return {
    parent: { options: {}, session: { requestHeader: () => undefined } },
    ...(agentOptions === undefined ? {} : { agentOptions }),
  } as never
}

const main = { provider: 'main-provider', model: 'main-model', reasoningEffort: ReasoningEffortId('max') }

describe('routeSubagentRequest Default Subagent route', () => {
  it('injects the stored route when fixed and the spawn names none', () => {
    const routed = routeSubagentRequest(
      request(),
      { subagentMode: 'fixed', subagentProvider: 'fixed-provider', subagentModel: 'fixed-model', subagentReasoningEffort: 'high' },
      main,
    )
    expect(routed.agentOptions).toEqual({
      provider: 'fixed-provider',
      model: 'fixed-model',
      reasoningEffort: ReasoningEffortId('high'),
    })
  })

  it('leaves an explicit child route unchanged when fixed is on', () => {
    const routed = routeSubagentRequest(
      request({ provider: 'named-provider', model: 'named-model', reasoningEffort: ReasoningEffortId('low') }),
      { subagentMode: 'fixed', subagentProvider: 'fixed-provider', subagentModel: 'fixed-model', subagentReasoningEffort: 'high' },
      main,
    )
    expect(routed.agentOptions).toEqual({
      provider: 'named-provider',
      model: 'named-model',
      reasoningEffort: ReasoningEffortId('low'),
    })
  })

  it('does not inject parent or Main when follow-main is stored', () => {
    const withParent = routeSubagentRequest(
      {
        parent: {
          options: { provider: 'ollama-cloud', model: 'kimi-k3' },
          session: {
            requestHeader: () => ({
              config: { provider: 'codex', model: 'gpt-5.6-luna', reasoningEffort: ReasoningEffortId('max') },
            }),
          },
        },
      } as never,
      { subagentMode: 'follow-main' },
      main,
    )
    expect(withParent.agentOptions).toBeUndefined()
    expect(routeSubagentRequest(request(), { subagentMode: 'follow-main' }, main).agentOptions).toBeUndefined()
  })

  it('does not inject when mode is missing', () => {
    expect(routeSubagentRequest(request(), {} as never, main).agentOptions).toBeUndefined()
  })

  it('rejects partial explicit and incomplete fixed routes', () => {
    expect(() => routeSubagentRequest(
      request({ provider: 'only-provider' }),
      { subagentMode: 'follow-main' },
      main,
    )).toThrow(SubagentRouteUnavailableError)
    expect(() => routeSubagentRequest(
      request(),
      { subagentMode: 'fixed', subagentProvider: 'fixed-provider' },
      main,
    )).toThrow('fixed Subagent policy requires')
  })
})
