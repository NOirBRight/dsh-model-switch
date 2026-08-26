import { ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { ModelSelection } from '@deepseek-ai/dsh-agent'

export type { ModelSelection, ReasoningEffortId }
export type ModelCapability = 'chat' | 'search' | 'vision' | 'image'

export interface ModelCapabilities {
  capabilities: readonly ModelCapability[]
  reasoningEfforts?: readonly ReasoningEffortId[]
  defaultReasoningEffort?: ReasoningEffortId
}
export interface ProviderCapabilities { models: Readonly<Record<string, ModelCapabilities>> }
export interface CapabilityCatalog { providers: Readonly<Record<string, ProviderCapabilities>> }

export class CapabilityValidationError extends Error { override readonly name = 'CapabilityValidationError' }

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new CapabilityValidationError(label + ' must be an object')
  return value as Record<string, unknown>
}

function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new CapabilityValidationError(label + ' must be a non-empty string')
  return value
}

export function parseReasoningEffortId(value: unknown, label = 'reasoningEffort'): ReasoningEffortId {
  return ReasoningEffortId(nonEmpty(value, label))
}

export function defineCapabilityCatalog(catalog: CapabilityCatalog): CapabilityCatalog {
  const providers = record(catalog.providers, 'providers')
  for (const [providerId, providerValue] of Object.entries(providers)) {
    nonEmpty(providerId, 'provider id')
    const models = record(record(providerValue, 'provider ' + providerId).models, 'provider ' + providerId + '.models')
    for (const [modelId, modelValue] of Object.entries(models)) {
      nonEmpty(modelId, 'model id')
      const label = providerId + '/' + modelId
      const model = record(modelValue, label)
      if (!Array.isArray(model.capabilities) || model.capabilities.length === 0) throw new CapabilityValidationError(label + ' must declare capabilities')
      for (const capability of model.capabilities as unknown[]) {
        if (!['chat', 'search', 'vision', 'image'].includes(String(capability))) throw new CapabilityValidationError(label + ' has an unknown capability')
      }
      const efforts = model.reasoningEfforts === undefined ? [] : model.reasoningEfforts
      if (!Array.isArray(efforts)) throw new CapabilityValidationError(label + '.reasoningEfforts must be an array')
      const parsedEfforts = efforts.map((item) => parseReasoningEffortId(item, label + '.reasoningEfforts'))
      if (new Set(parsedEfforts).size !== parsedEfforts.length) throw new CapabilityValidationError(label + '.reasoningEfforts contains duplicates')
      if (model.defaultReasoningEffort !== undefined && !parsedEfforts.includes(parseReasoningEffortId(model.defaultReasoningEffort, label + '.defaultReasoningEffort'))) {
        throw new CapabilityValidationError(label + '.defaultReasoningEffort must be listed in efforts')
      }
    }
  }
  return catalog
}

export function validateModelSelection(
  catalog: CapabilityCatalog,
  input: unknown,
  requiredCapability: ModelCapability = 'chat',
): ModelSelection {
  const value = record(input, 'model selection')
  const provider = nonEmpty(value.provider, 'provider')
  const model = nonEmpty(value.model, 'model')
  const providerCapabilities = catalog.providers[provider]
  if (providerCapabilities === undefined) throw new CapabilityValidationError('unknown provider: ' + provider)
  const modelCapabilities = providerCapabilities.models[model]
  if (modelCapabilities === undefined) throw new CapabilityValidationError('unknown model: ' + provider + '/' + model)
  if (!modelCapabilities.capabilities.includes(requiredCapability)) throw new CapabilityValidationError(provider + '/' + model + ' does not support ' + requiredCapability)
  if (value.reasoningEffort === undefined) return { provider, model }
  const selectedEffort = parseReasoningEffortId(value.reasoningEffort, 'reasoningEffort')
  if (!(modelCapabilities.reasoningEfforts ?? []).includes(selectedEffort)) {
    throw new CapabilityValidationError(provider + '/' + model + ' does not support reasoning effort ' + selectedEffort)
  }
  return { provider, model, reasoningEffort: selectedEffort }
}

export function resolveDefaultEffort(catalog: CapabilityCatalog, selection: ModelSelection): ModelSelection {
  const validated = validateModelSelection(catalog, selection)
  if (validated.reasoningEffort !== undefined) return validated
  const defaultEffort = catalog.providers[validated.provider]?.models[validated.model]?.defaultReasoningEffort
  return defaultEffort === undefined ? validated : { ...validated, reasoningEffort: defaultEffort }
}
