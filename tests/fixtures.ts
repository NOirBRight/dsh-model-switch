import { defineCapabilityCatalog } from '../src/capabilities.js'

export const catalog = defineCapabilityCatalog({ providers: {
  deepseek: { models: {
    'deep-chat': { capabilities: ['chat'], reasoningEfforts: ['off', 'max'], defaultReasoningEffort: 'off' },
    'deep-search': { capabilities: ['search'] },
    'deep-vision': { capabilities: ['vision'] },
  } },
  codex: { models: {
    'codex-chat': { capabilities: ['chat'], reasoningEfforts: ['standard', 'ultra'], defaultReasoningEffort: 'standard' },
    'codex-search': { capabilities: ['search'] },
    'gpt-image-2': { capabilities: ['image'] },
    'codex-vision': { capabilities: ['vision'] },
  } },
  grok: { models: {
    'verified-search-model': { capabilities: ['search'] },
    'unverified-search-model': { capabilities: ['search'] },
    'grok-imagine': { capabilities: ['image'] },
  } },
} })
