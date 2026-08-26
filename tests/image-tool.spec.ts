import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import { ModelSwitchAdapterRegistry } from '../src/adapter-registry.js'
import { installGenerateImageTool } from '../src/image-tool.js'

function setup(route: Record<string, unknown>) {
  const registered = new Map<string, ToolDefinition>()
  const ctx = { inject: (_deps: string[], activate: (scope: { tools: { register(tool: ToolDefinition): () => void } }) => unknown) => activate({ tools: { register(tool) { registered.set(tool.name, tool); return () => { registered.delete(tool.name) } } } }) } as unknown as Context
  const adapters = new ModelSwitchAdapterRegistry()
  installGenerateImageTool(ctx, { currentSettings: () => ({ subagentMode: 'follow-main', ...route } as never), adapters })
  return { adapters, tool: registered.get('generate_image') }
}

describe('stable generate_image tool', () => {
  it('routes Codex requests with public execution context and rejects Grok-only fields', async () => {
    const { adapters, tool } = setup({ imageProvider: 'codex', imageModel: 'gpt-image' })
    const generated = { path: 'out.png', mediaType: 'image/png', width: 2, height: 3, attachmentId: 'a1' }
    const generate = vi.fn(async () => generated)
    adapters.register({ provider: 'codex', image: { provider: 'codex', supportsModel: model => model === 'gpt-image', generate } })
    expect(tool).toBeDefined()
    const execution = { signal: new AbortController().signal }
    await expect(tool!.execute({ prompt: 'draw', source: 'in.png', outputFormat: 'png' } as never, execution as never)).resolves.toMatchObject({ provider: 'codex', model: 'gpt-image', ...generated })
    expect(generate).toHaveBeenCalledWith('gpt-image', { prompt: 'draw', source: 'in.png', outputFormat: 'png' }, execution)
    await expect(tool!.execute({ prompt: 'draw', aspectRatio: '1:1' } as never, execution as never)).rejects.toThrow('does not accept aspectRatio')
    await expect(tool!.execute({ prompt: 'draw', source: '', aspectRatio: '' } as never, execution as never)).resolves.toMatchObject({ provider: 'codex' })
    expect(generate).toHaveBeenLastCalledWith('gpt-image', { prompt: 'draw' }, execution)
  })

  it('routes Grok requests and rejects Codex-only fields', async () => {
    const { adapters, tool } = setup({ imageProvider: 'grok', imageModel: 'grok-imagine-image-quality' })
    const generate = vi.fn(async () => ({ path: 'out.png', mediaType: 'image/png', width: 2, height: 3 }))
    adapters.register({ provider: 'grok', image: { provider: 'grok', supportsModel: model => model === 'grok-imagine-image-quality', generate } })
    await expect(tool!.execute({ prompt: 'draw', aspectRatio: '16:9' } as never, {} as never)).resolves.toMatchObject({ provider: 'grok', model: 'grok-imagine-image-quality' })
    expect(generate).toHaveBeenCalledWith('grok-imagine-image-quality', { prompt: 'draw', aspectRatio: '16:9' }, {})
    await expect(tool!.execute({ prompt: 'draw', source: 'in.png' } as never, {} as never)).rejects.toThrow('does not accept source or outputFormat')
  })

  it('rejects malformed provider image metadata', async () => {
    const { adapters, tool } = setup({ imageProvider: 'codex', imageModel: 'gpt-image' })
    adapters.register({ provider: 'codex', image: { provider: 'codex', supportsModel: () => true, generate: vi.fn(async () => ({ path: 'out.png', mediaType: 'text/plain', width: 2, height: 3, bytes: -1 })) } })
    await expect(tool!.execute({ prompt: 'draw' } as never, {} as never)).rejects.toThrow('invalid media type')
  })

  it('regenerates a provider-specific schema so models are not prompted for incompatible fields', async () => {
    let route = { imageProvider: 'codex', imageModel: 'gpt-image' }
    const registered = new Map<string, ToolDefinition>()
    const ctx = { inject: (_deps: string[], activate: (scope: { tools: { register(tool: ToolDefinition): () => void } }) => unknown) => activate({ tools: { register(tool) { registered.set(tool.name, tool); return () => { if (registered.get(tool.name) === tool) registered.delete(tool.name) } } } }) } as unknown as Context
    const controller = installGenerateImageTool(ctx, { currentSettings: () => route, adapters: new ModelSwitchAdapterRegistry() })
    expect(Object.keys((registered.get('generate_image')!.parameters as { properties: Record<string, unknown> }).properties)).toEqual(['prompt', 'path', 'source', 'outputFormat'])
    route = { imageProvider: 'grok', imageModel: 'grok-imagine-image-quality' }
    await controller.reconcile()
    expect(Object.keys((registered.get('generate_image')!.parameters as { properties: Record<string, unknown> }).properties)).toEqual(['prompt', 'path', 'aspectRatio'])
  })

  it('fails closed for missing configuration, adapter, or unsupported model', async () => {
    const missingRoute = setup({})
    await expect(missingRoute.tool!.execute({ prompt: 'draw' } as never, {} as never)).rejects.toThrow('image provider and model must be configured')
    const missingAdapter = setup({ imageProvider: 'codex', imageModel: 'gpt-image' })
    await expect(missingAdapter.tool!.execute({ prompt: 'draw' } as never, {} as never)).rejects.toThrow('missing image adapter: codex')
    missingAdapter.adapters.register({ provider: 'codex', image: { provider: 'codex', supportsModel: () => false, generate: vi.fn() } })
    await expect(missingAdapter.tool!.execute({ prompt: 'draw' } as never, {} as never)).rejects.toThrow('not supported')
  })
})
