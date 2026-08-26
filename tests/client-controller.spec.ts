import { describe, expect, it } from 'vitest'
import { MainSettingsConflictError } from '../src/client-contract.js'
import { acceptedRevisionAfterFailure, deriveMainChoices, expectedMainRevision } from '../src/client/main-row-controller.js'

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
})
