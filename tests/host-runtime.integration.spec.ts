import { describe, expect, it } from 'vitest'
import { Context, Service } from '@deepseek-ai/cordis'
import { AgentDefaultModelConfig } from '@deepseek-ai/dsh-agent-default-model'
import { WebRuntime } from '@deepseek-ai/dsh-web'
import ModelSwitchRuntime from '../src/index.js'

class TestSettings extends Service {
  constructor(ctx: Context) { super(ctx, 'settings') }
  configure(): () => void { return () => undefined }
}

describe('Host runtime integration', () => {
  it('routes Web searches through the configured volatile settings and disposes cleanly', async () => {
    const ctx = new Context()
    const settingsFiber = ctx.plugin(TestSettings)
    await settingsFiber
    const mainFiber = ctx.plugin(AgentDefaultModelConfig, { provider: 'deepseek', model: 'chat' })
    await mainFiber
    const webFiber = ctx.plugin(WebRuntime, { searchProvider: 'model-switch' })
    await webFiber
    const runtimeFiber = ctx.plugin(ModelSwitchRuntime, {
      subagentMode: 'fixed', subagentProvider: 'uninstalled', subagentModel: 'remember-me',
      searchProvider: 'codex', searchModel: 'gpt-search', imageProvider: 'grok', imageModel: 'grok-imagine-image-quality',
    })
    await runtimeFiber

    expect(ctx.modelSwitch.currentSettings()).toMatchObject({
      subagentMode: 'fixed', subagentProvider: 'uninstalled', searchProvider: 'codex', imageProvider: 'grok',
    })
    const searchResult = { content: 'thin', sources: [], truncated: false }
    const disposeAdapter = ctx.modelSwitch.adapters.register({
      provider: 'codex', search: { provider: 'codex', supportsModel: model => model === 'gpt-search', search: async () => searchResult },
    })
    await expect(ctx.web.search({ query: 'route me' })).resolves.toBe(searchResult)
    expect(ctx.modelSwitch.currentMainSelection()).toEqual({ provider: 'deepseek', model: 'chat' })

    disposeAdapter()
    await runtimeFiber.dispose()
    expect(ctx.get('modelSwitch')).toBeUndefined()
    await expect(ctx.web.search({ query: 'after disposal' })).rejects.toMatchObject({ code: 'WEB_PROVIDER_CONFIGURED_MISSING' })
    await webFiber.dispose()
    await mainFiber.dispose()
    await settingsFiber.dispose()
  })
})
