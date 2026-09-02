import { describe, expect, it, vi } from 'vitest'
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import ModelSwitchRuntime, { Config, MODEL_SWITCH_SETTINGS_NAMESPACE, RUNTIME_CAPABILITIES, mainDefaultPort, name } from '../src/index.js'

describe('Host runtime surface', () => {
  it('preserves package identity and released injection contract', () => {
    expect(name).toBe('dsh-model-switch')
    expect(ModelSwitchRuntime.inject).toEqual(['agentDefaultModel'])
    expect(String(MODEL_SWITCH_SETTINGS_NAMESPACE)).toBe('model-switch')
  })
  it('defaults Subagent to follow-main and retains unavailable choices', () => {
    expect(Config({})).toEqual({ subagentMode: 'follow-main' })
    expect(Config({ subagentMode: 'fixed', subagentProvider: 'not-installed', subagentModel: 'remember-me' })).toMatchObject({ subagentProvider: 'not-installed', subagentModel: 'remember-me' })
    expect(() => Config({ subagentMode: 'other' } as never)).toThrow()
  })
  it('adapts the public Main service without changing picker/global state', async () => {
    let selection = { provider: 'deepseek', model: 'chat', reasoningEffort: ReasoningEffortId('max') }
    const service = { currentSelection: vi.fn(() => selection), saveSelection: vi.fn(async (next) => { selection = next }) }
    const port = mainDefaultPort(service as never)
    expect(port.currentSelection()).toEqual(selection)
    await port.saveSelection({ provider: 'codex', model: 'gpt', reasoningEffort: ReasoningEffortId('high') })
    expect(service.saveSelection).toHaveBeenCalledOnce()
    expect(port.currentSelection().provider).toBe('codex')
  })
  it('reports available routing and remaining Alpha.4 gaps', () => {
    expect(RUNTIME_CAPABILITIES.mainDefaults.available).toBe(true)
    expect(RUNTIME_CAPABILITIES.settings.available).toBe(true)
    expect(RUNTIME_CAPABILITIES.centralSubagentRouting.available).toBe(true)
    expect(RUNTIME_CAPABILITIES.packagedPresetRoots).toEqual({ available: false, reason: 'packaged-preset-roots' })
    expect(RUNTIME_CAPABILITIES.toolOwnerSuppression.available).toBe(false)
    expect(RUNTIME_CAPABILITIES.searchProviderAdapters).toEqual({ available: true, providers: ['codex'] })
    expect(RUNTIME_CAPABILITIES.imageProviderAdapters).toEqual({ available: true, providers: ['codex', 'grok'] })
    expect(RUNTIME_CAPABILITIES.visionProviderAdapters).toEqual({ available: false, reason: 'vision-provider-adapters' })
    expect(Object.isFrozen(RUNTIME_CAPABILITIES)).toBe(true)
  })
})
