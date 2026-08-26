import { describe, expect, it } from 'vitest'
import { CapabilityValidationError, defineCapabilityCatalog, resolveDefaultEffort, validateModelSelection } from '../src/capabilities.js'
import { catalog } from './fixtures.js'

describe('capability catalog and model selection', () => {
  it('validates provider-defined opaque reasoning efforts', () => {
    expect(validateModelSelection(catalog, { provider: 'deepseek', model: 'deep-chat', reasoningEffort: 'max' }))
      .toEqual({ provider: 'deepseek', model: 'deep-chat', reasoningEffort: 'max' })
    expect(validateModelSelection(catalog, { provider: 'codex', model: 'codex-chat', reasoningEffort: 'ultra' }))
      .toEqual({ provider: 'codex', model: 'codex-chat', reasoningEffort: 'ultra' })
  })
  it.each([
    [{ provider: '', model: 'deep-chat' }, 'provider'],
    [{ provider: 'missing', model: 'deep-chat' }, 'unknown provider'],
    [{ provider: 'deepseek', model: 'missing' }, 'unknown model'],
    [{ provider: 'deepseek', model: 'deep-chat', reasoningEffort: 'standard' }, 'does not support reasoning effort'],
  ])('rejects invalid selection %#', (selection, message) => {
    expect(() => validateModelSelection(catalog, selection)).toThrow(message)
  })
  it('rejects a model missing the required capability', () => {
    expect(() => validateModelSelection(catalog, { provider: 'deepseek', model: 'deep-chat' }, 'search')).toThrow('does not support search')
  })
  it('applies the declared default effort without mutating input', () => {
    const input = { provider: 'deepseek', model: 'deep-chat' }
    expect(resolveDefaultEffort(catalog, input)).toEqual({ ...input, reasoningEffort: 'off' })
    expect(input).toEqual({ provider: 'deepseek', model: 'deep-chat' })
  })
  it('accepts arbitrary non-empty provider effort ids and rejects malformed declarations', () => {
    expect(() => defineCapabilityCatalog({ providers: { ok: { models: { model: { capabilities: ['chat'], reasoningEfforts: ['custom-budget'], defaultReasoningEffort: 'custom-budget' } } } } })).not.toThrow()
    expect(() => defineCapabilityCatalog({ providers: { bad: { models: { model: { capabilities: ['chat'], reasoningEfforts: ['off'], defaultReasoningEffort: 'max' } } } } })).toThrow(CapabilityValidationError)
  })
})
