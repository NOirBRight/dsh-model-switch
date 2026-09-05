import type { Context } from '@deepseek-ai/cordis'
import { credentialRef, isCredentialRefName } from '@deepseek-ai/dsh-credentials'
import type { CredentialRef } from '@deepseek-ai/dsh-credentials'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import type { WebSearchRequest, WebSearchResult } from '@deepseek-ai/dsh-web'
import {
  Config as DeepSeekSearchConfig,
  DEEPSEEK_DEFAULT_API_VERSION,
  DEEPSEEK_DEFAULT_BASE_URL,
  DEEPSEEK_DEFAULT_MAX_TOKENS,
  DEEPSEEK_DEFAULT_MAX_USES,
  DEEPSEEK_DEFAULT_MODEL,
  DEEPSEEK_PROVIDER_ID,
  DeepSeekSearchProvider,
  WEB_SEARCH_DEEPSEEK_SETTINGS_NAMESPACE,
} from '@deepseek-ai/dsh-web-search-deepseek'
import type {
  Config as DeepSeekSearchSection,
  DeepSeekSearchLlmRequest,
  DeepSeekSearchProviderOptions,
} from '@deepseek-ai/dsh-web-search-deepseek'
import type { ModelSwitchSearchAdapter, SearchModel } from './adapter-registry.js'

const DEFAULT_API_KEY_REF = 'DEEPSEEK_API_KEY'
const SEARCH_BASE_URL_ENV = 'DEEPSEEK_SEARCH_BASE_URL'

// Ids/names follow the official dsh-llm-deepseek catalog. Both models passed
// the lab search endpoint checks recorded in docs/search-provider-audit.md.
// Vision-exp excluded: no evidence it serves web_search.
export const DEEPSEEK_SEARCH_MODELS: readonly SearchModel[] = [
  { id: DEEPSEEK_DEFAULT_MODEL, name: 'DeepSeek-V4-Flash' },
  { id: 'deepseek-v4-pro', name: 'DeepSeek-V4-Pro' },
]

// Host-only read validated by the official schema: same-process get returns the
// full value (redaction lives only on the describe wire path), so a literal apiKey
// stays usable here and is passed only into the official provider options.
// The official ValidationError can echo values, so invalid sections fail static.
// An unregistered namespace resolves through schema defaults.
function readDeepSeekSection(ctx: Context): DeepSeekSearchSection {
  const raw = ctx.get('settings')?.get(WEB_SEARCH_DEEPSEEK_SETTINGS_NAMESPACE)
  try {
    return DeepSeekSearchConfig(raw ?? {})
  } catch {
    throw new Error('invalid web-search-deepseek settings section')
  }
}

function keyRef(section: DeepSeekSearchSection): CredentialRef {
  const name = section.apiKeyEnv ?? DEFAULT_API_KEY_REF
  // Static diagnostic: the official credentialRef TypeError echoes its input, and a
  // mistyped apiKeyEnv may itself be pasted secret material.
  if (!isCredentialRefName(name)) throw new Error('invalid web-search-deepseek apiKeyEnv credential reference')
  return credentialRef(name)
}

function recordSearchRequest(ctx: Context, request: DeepSeekSearchLlmRequest): void {
  const initiator = ctx.get('agents')?.currentInitiator?.() as unknown as
    | { session?: { append: (event: string, data: unknown) => unknown } }
    | undefined
  initiator?.session?.append('web/deepseek-search-llm-request', request)
}

// One-search binding: section supplies endpoint/keys/limits (launch env, then public
// official defaults, like the official private resolver); the per-call model wins.
// No HTTP/auth copied: these options feed the public DeepSeekSearchProvider.
function toProviderOptions(ctx: Context, section: DeepSeekSearchSection, model: string): DeepSeekSearchProviderOptions {
  const apiKeyEnv = keyRef(section)
  const literalApiKey = section.apiKey !== undefined && section.apiKey.length > 0 ? section.apiKey : undefined
  return {
    ...(literalApiKey === undefined ? {} : { apiKey: literalApiKey }),
    resolveApiKey: async () => {
      const credentials = ctx.get('credentials')
      if (credentials !== undefined) return (await credentials.resolve(apiKeyEnv))?.value
      const ambient = launchEnvironmentOf(ctx).get(apiKeyEnv)
      return ambient !== undefined && ambient.value.length > 0 ? ambient.value : undefined
    },
    apiKeyEnv,
    baseURL: section.baseURL ?? launchEnvironmentOf(ctx).get(SEARCH_BASE_URL_ENV)?.value ?? DEEPSEEK_DEFAULT_BASE_URL,
    model,
    apiVersion: section.apiVersion ?? DEEPSEEK_DEFAULT_API_VERSION,
    maxTokens: section.maxTokens ?? DEEPSEEK_DEFAULT_MAX_TOKENS,
    maxUses: section.maxUses ?? DEEPSEEK_DEFAULT_MAX_USES,
    recordRequest: (request) => { recordSearchRequest(ctx, request) },
  }
}

// Reuses the official HTTP implementation. Host-only: only provider/label/models
// metadata is safe to publish to clients, never secrets.
export class DeepSeekSearchAdapter implements ModelSwitchSearchAdapter {
  readonly provider = DEEPSEEK_PROVIDER_ID
  readonly label = 'DeepSeek'
  readonly models = DEEPSEEK_SEARCH_MODELS

  constructor(private readonly ctx: Context) {}

  supportsModel(model: string): boolean {
    return DEEPSEEK_SEARCH_MODELS.some((known) => known.id === model)
  }

  async search(model: string, request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    if (!this.supportsModel(model)) throw new Error('search model is not supported by adapter: ' + DEEPSEEK_PROVIDER_ID + '/' + model)
    const options = toProviderOptions(this.ctx, readDeepSeekSection(this.ctx), model)
    return new DeepSeekSearchProvider(() => options).search(request, signal)
  }
}

// Registers into the existing Model Switch registry (no third registry).
// Disposal follows the modelSwitch fiber.
export function installDeepSeekSearchAdapter(ctx: Context): void {
  ctx.inject(['modelSwitch'], (scope) =>
    scope.effect(
      () => scope.modelSwitch.adapters.register({ provider: DEEPSEEK_PROVIDER_ID, search: new DeepSeekSearchAdapter(ctx) }),
      'Model Switch: register DeepSeek search adapter',
    ),
  )
}
