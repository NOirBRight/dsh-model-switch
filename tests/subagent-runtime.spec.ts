import { describe, expect, it } from 'vitest'
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import { routeSubagentRequest, SubagentRouteUnavailableError } from '../src/subagent-runtime.js'

function request(agentOptions?: { provider?: string; model?: string; reasoningEffort?: ReturnType<typeof ReasoningEffortId> }) {
  return {
    parent: { options: {}, session: { requestHeader: () => undefined } },
    ...(agentOptions === undefined ? {} : { agentOptions }),
  } as never
}

describe('routeSubagentRequest Default Subagent route', () => {
  it('injects the stored route when fixed and the spawn names none', () => {
    const routed = routeSubagentRequest(
      request(),
      { subagentMode: 'fixed', subagentProvider: 'fixed-provider', subagentModel: 'fixed-model', subagentReasoningEffort: 'high' },
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
    )
    expect(routed.agentOptions).toEqual({
      provider: 'named-provider',
      model: 'named-model',
      reasoningEffort: ReasoningEffortId('low'),
    })
  })

  it('leaves an effort-only spawn unchanged so Official inherit can fill provider and model', () => {
    const routed = routeSubagentRequest(
      request({ reasoningEffort: ReasoningEffortId('low') }),
      { subagentMode: 'fixed', subagentProvider: 'fixed-provider', subagentModel: 'fixed-model', subagentReasoningEffort: 'high' },
    )
    expect(routed.agentOptions).toEqual({ reasoningEffort: ReasoningEffortId('low') })
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
    )
    expect(withParent.agentOptions).toBeUndefined()
    expect(routeSubagentRequest(request(), { subagentMode: 'follow-main' }).agentOptions).toBeUndefined()
  })

  it('does not inject when mode is missing', () => {
    expect(routeSubagentRequest(request(), {} as never).agentOptions).toBeUndefined()
  })

  it('rejects partial explicit routes and passes incomplete fixed through to Official inherit', () => {
    expect(() => routeSubagentRequest(
      request({ provider: 'only-provider' }),
      { subagentMode: 'follow-main' },
    )).toThrow(SubagentRouteUnavailableError)
    expect(routeSubagentRequest(
      request(),
      { subagentMode: 'fixed', subagentProvider: 'fixed-provider' },
    ).agentOptions).toBeUndefined()
  })
})
