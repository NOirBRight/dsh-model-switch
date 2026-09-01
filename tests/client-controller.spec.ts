import { describe, expect, it } from 'vitest'
import { MainSettingsConflictError } from '../src/client-contract.js'
import { acceptedRevisionAfterFailure, deriveMainChoices, expectedMainRevision, selectRouteModel } from '../src/client/main-row-controller.js'

describe('Model Switch Settings controller contracts', () => {
  const groups = [{ id: 'codex', name: 'Codex', models: [
    { id: 'gpt-a', name: 'GPT A', reasoning: { efforts: [{ id: 'low', name: 'Low' }], defaultEffort: 'low' } },
    { id: 'gpt-b', name: 'GPT B' },
  ] }]
  it('filters model and effort choices through the selected provider route', () => {
    expect(deriveMainChoices(groups, { provider: 'codex', model: 'gpt-a' })).toEqual({
      providers: [{ id: 'codex', name: 'Codex' }], models: [{ id: 'gpt-a', name: 'GPT A' }, { id: 'gpt-b', name: 'GPT B' }], efforts: [{ id: 'low', name: 'Low' }],
    })
    expect(deriveMainChoices(groups, { provider: 'codex', model: 'gpt-b' }).efforts).toEqual([])
  })
  it('keeps an unavailable stored route visible and converges to newer mirror revisions', () => {
    expect(deriveMainChoices(groups, { provider: 'missing', model: 'remember', reasoningEffort: 'custom' })).toMatchObject({ providers: [{ id: 'codex' }, { id: 'missing' }], models: [{ id: 'remember' }], efforts: [{ id: 'custom' }] })
    expect(expectedMainRevision(9, 8)).toBe(9)
    expect(expectedMainRevision(8, 9)).toBe(9)
    expect(acceptedRevisionAfterFailure(9, new Error('settings-rejected'))).toBe(9)
    expect(acceptedRevisionAfterFailure(9, new MainSettingsConflictError('conflict'))).toBeUndefined()
  })
  it('replaces the previous model effort with the selected model default', () => {
    const providerGroups = [
      { id: 'codex', name: 'Codex', models: [{ id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', reasoning: { efforts: [{ id: 'max', name: 'Max' }], defaultEffort: 'max' } }] },
      { id: 'opencode-go', name: 'OpenCode Go', models: [
        { id: 'muse-spark', name: 'Muse Spark 1.2 Contributor' },
        { id: 'reasoning-model', name: 'Reasoning Model', reasoning: { efforts: [{ id: 'xhigh', name: 'Xhigh' }], defaultEffort: 'xhigh' } },
      ] },
    ]

    expect(selectRouteModel(providerGroups, 'opencode-go', 'muse-spark')).toEqual({
      provider: 'opencode-go',
      model: 'muse-spark',
    })
    expect(selectRouteModel(providerGroups, 'opencode-go', 'reasoning-model')).toEqual({
      provider: 'opencode-go',
      model: 'reasoning-model',
      reasoningEffort: 'xhigh',
    })
  })
})
