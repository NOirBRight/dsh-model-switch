import type { Context } from '@deepseek-ai/cordis'
import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { ImageOutputFormat, ModelSwitchAdapterRegistry, ModelSwitchGeneratedImage, ModelSwitchImageRequest } from './adapter-registry.js'

export const GENERATE_IMAGE_TOOL_NAME = 'generate_image'
interface ImageSettings { readonly imageProvider?: string; readonly imageModel?: string }
export interface ImageToolRuntime { currentSettings(): ImageSettings; readonly adapters: ModelSwitchAdapterRegistry }
export interface ImageToolController { reconcile(): Promise<void> }

function selected(settings: ImageSettings): { provider: string; model: string } {
  const provider = settings.imageProvider?.trim(); const model = settings.imageModel?.trim()
  if (provider === undefined || provider === '' || model === undefined || model === '') throw new Error('image provider and model must be configured in Model Switch')
  return { provider, model }
}
function optional(value: unknown): string | undefined { return typeof value === 'string' && value.trim() !== '' ? value : undefined }
function validateGenerated(value: ModelSwitchGeneratedImage): ModelSwitchGeneratedImage {
  if (typeof value !== 'object' || value === null) throw new Error('image adapter returned invalid metadata')
  if (typeof value.path !== 'string' || value.path.trim() === '') throw new Error('image adapter returned empty path')
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(value.mediaType)) throw new Error('image adapter returned invalid media type')
  if (!Number.isInteger(value.width) || value.width <= 0 || !Number.isInteger(value.height) || value.height <= 0) throw new Error('image adapter returned invalid dimensions')
  if (value.bytes !== undefined && (!Number.isInteger(value.bytes) || value.bytes <= 0)) throw new Error('image adapter returned invalid byte count')
  if (value.attachmentId !== undefined && (typeof value.attachmentId !== 'string' || value.attachmentId.trim() === '')) throw new Error('image adapter returned invalid attachment id')
  return value
}

function createGenerateImageTool(runtime: ImageToolRuntime): ToolDefinition {
  const schemaProvider = runtime.currentSettings().imageProvider?.trim()
  const parameters = {
    prompt: { type: 'string' as const, required: true as const, description: 'Detailed image prompt.' },
    path: { type: 'string' as const, description: 'Optional workspace-relative destination.' },
    ...(schemaProvider === 'codex' ? {
      source: { type: 'string' as const, description: 'Optional source image for editing. Omit for a new image.' },
      outputFormat: { type: 'string' as const, enum: ['png', 'jpeg', 'webp'] as const, description: 'Output format.' },
    } : {}),
    ...(schemaProvider === 'grok' ? { aspectRatio: { type: 'string' as const, description: 'Optional Grok aspect ratio, for example 1:1 or 16:9.' } } : {}),
  }
  return defineTool({
    name: GENERATE_IMAGE_TOOL_NAME,
    description: schemaProvider === 'codex' ? 'Generate or edit a raster image through the Codex model selected in Model Switch.' : schemaProvider === 'grok' ? 'Generate a raster image through the Grok model selected in Model Switch.' : 'Generate a raster image through the provider and model selected in Model Switch.',
    parameters,
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        provider: { type: 'string', required: true }, model: { type: 'string', required: true }, path: { type: 'string', required: true }, mediaType: { type: 'string', required: true }, width: { type: 'integer', required: true }, height: { type: 'integer', required: true }, bytes: { type: 'integer' }, attachmentId: { type: 'string' }, name: { type: 'string' }, revisedPrompt: { type: 'string' },
      } },
      render: (_args, value) => [{ type: 'text', text: value.path }],
    },
    async execute(rawArgs, execution) {
      const args = rawArgs as { prompt?: unknown; path?: unknown; source?: unknown; outputFormat?: unknown; aspectRatio?: unknown }
      if (typeof args.prompt !== 'string' || args.prompt.trim() === '') throw new Error('image prompt must be non-empty')
      const route = selected(runtime.currentSettings())
      const path = optional(args.path); const source = optional(args.source); const aspectRatio = optional(args.aspectRatio); const outputFormat = optional(args.outputFormat) as ImageOutputFormat | undefined
      if (route.provider === 'codex' && aspectRatio !== undefined) throw new Error('Codex image generation does not accept aspectRatio')
      if (route.provider === 'grok' && (source !== undefined || outputFormat !== undefined)) throw new Error('Grok image generation does not accept source or outputFormat')
      if (route.provider !== 'codex' && route.provider !== 'grok') throw new Error('image provider must be codex or grok')
      const adapter = runtime.adapters.get(route.provider)?.image
      if (adapter === undefined) throw new Error('missing image adapter: ' + route.provider)
      if (!adapter.supportsModel(route.model)) throw new Error('image model is not supported by adapter: ' + route.provider + '/' + route.model)
      const request: ModelSwitchImageRequest = { prompt: args.prompt, ...(path === undefined ? {} : { path }), ...(source === undefined ? {} : { source }), ...(outputFormat === undefined ? {} : { outputFormat }), ...(aspectRatio === undefined ? {} : { aspectRatio }) }
      const generated = validateGenerated(await adapter.generate(route.model, request, execution))
      return { provider: route.provider, model: route.model, ...generated }
    },
  })
}

/** Registers one provider-specific schema and replaces it transactionally on Settings changes. */
export function installGenerateImageTool(ctx: Context, runtime: ImageToolRuntime): ImageToolController {
  let register: ((tool: ToolDefinition) => () => void) | undefined
  let current: { readonly tool: ToolDefinition; readonly dispose: () => void } | undefined
  let tail = Promise.resolve()
  const replace = (): void => {
    if (register === undefined) return
    const next = createGenerateImageTool(runtime)
    const previous = current
    previous?.dispose()
    try { current = { tool: next, dispose: register(next) } }
    catch (error) {
      current = previous === undefined ? undefined : { tool: previous.tool, dispose: register(previous.tool) }
      throw error
    }
  }
  const controller: ImageToolController = {
    reconcile() {
      const operation = tail.then(replace, replace)
      tail = operation.catch(() => {})
      return operation
    },
  }
  ctx.inject(['tools'], scope => {
    register = tool => scope.tools.register(tool)
    replace()
    return () => { current?.dispose(); current = undefined; register = undefined }
  })
  return controller
}
