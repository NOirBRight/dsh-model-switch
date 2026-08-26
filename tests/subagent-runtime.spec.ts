import { describe, expect, it } from 'vitest'
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import { routeSubagentRequest, SubagentRouteUnavailableError } from '../src/subagent-runtime.js'

function request(agentOptions?: { provider?: string; model?: string }) {
  return {
    parent: { options: {}, session: { requestHeader: () => undefined } },
    ...(agentOptions === undefined ? {} : { agentOptions }),
  } as never
}

describe('routeSubagentRequest fail-closed policy', () => {
  it('uses Main when follow-main has no parent/current route', () => {
    const routed = routeSubagentRequest(
      request(),
      { subagentMode: 'follow-main' },
      { provider: 'main-provider', model: 'main-model', reasoningEffort: ReasoningEffortId('max') },
    )
    expect(routed.agentOptions).toEqual({ provider: 'main-provider', model: 'main-model' })
  })

  it('rejects partial explicit and incomplete fixed routes', () => {
    expect(() => routeSubagentRequest(
      request({ provider: 'only-provider' }),
      { subagentMode: 'follow-main' },
      { provider: 'main-provider', model: 'main-model' },
    )).toThrow(SubagentRouteUnavailableError)
    expect(() => routeSubagentRequest(
      request(),
      { subagentMode: 'fixed', subagentProvider: 'fixed-provider' },
      { provider: 'main-provider', model: 'main-model' },
    )).toThrow('fixed Subagent policy requires')
  })

  it('follows the active parent request model when rc.2 cannot carry its effort', () => {
    const routed = routeSubagentRequest(
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
      { provider: 'main-provider', model: 'main-model' },
    )

    expect(routed.agentOptions).toEqual({ provider: 'codex', model: 'gpt-5.6-luna' })
  })

  it('rejects configured Subagent effort instead of losing it across one-shot or cold resume', () => {
    expect(() => routeSubagentRequest(
      request(),
      { subagentMode: 'fixed', subagentProvider: 'fixed-provider', subagentModel: 'fixed-model', subagentReasoningEffort: 'high' },
      { provider: 'main-provider', model: 'main-model' },
    )).toThrow('unreleased rc.2')
  })
})
