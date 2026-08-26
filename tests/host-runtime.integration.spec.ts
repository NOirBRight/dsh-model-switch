import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { AgentDefaultModelConfig } from '@deepseek-ai/dsh-agent-default-model'
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import { SettingsProvider, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import { WebRuntime } from '@deepseek-ai/dsh-web'
import ModelSwitchRuntime, { Config, MODEL_SWITCH_SETTINGS_NAMESPACE } from '../src/index.js'

class MemorySettings extends SettingsProvider {
  document: Record<string, unknown> = {}
  get writable(): boolean { return true }
  protected load(): Promise<Record<string, unknown>> { return Promise.resolve(structuredClone(this.document)) }
  protected persist(ns: SettingsNamespace, section: Record<string, unknown>): Promise<void> {
    this.document[String(ns)] = structuredClone(section)
    return Promise.resolve()
  }
}

describe('Host runtime integration', () => {
  it('registers Settings, follows committed updates, delegates Main, and disposes cleanly', async () => {
    const ctx = new Context()
    const settingsFiber = ctx.plugin(MemorySettings)
    await settingsFiber
    const mainFiber = ctx.plugin(AgentDefaultModelConfig, { provider: 'deepseek', model: 'chat' })
    await mainFiber
    const webFiber = ctx.plugin(WebRuntime, { searchProvider: 'model-switch' })
    await webFiber
    const runtimeFiber = ctx.plugin(ModelSwitchRuntime, Config({}))
    await runtimeFiber

    expect(ctx.modelSwitch.currentSettings()).toEqual({ subagentMode: 'follow-main' })
    await ctx.settings.update(MODEL_SWITCH_SETTINGS_NAMESPACE, {
      subagentMode: 'fixed', subagentProvider: 'uninstalled', subagentModel: 'remember-me',
      searchProvider: 'codex', searchModel: 'gpt-search', imageProvider: 'grok', imageModel: 'grok-imagine-image-quality',
    })
    expect(ctx.modelSwitch.currentSettings()).toMatchObject({ subagentMode: 'fixed', subagentProvider: 'uninstalled', searchProvider: 'codex', imageProvider: 'grok' })
    const searchResult = { content: 'thin', sources: [], truncated: false }
    const disposeAdapter = ctx.modelSwitch.adapters.register({ provider: 'codex', search: { provider: 'codex', supportsModel: model => model === 'gpt-search', search: async () => searchResult } })
    await expect(ctx.web.search({ query: 'route me' })).resolves.toBe(searchResult)

    await ctx.modelSwitch.saveMainSelection({ provider: 'codex', model: 'gpt', reasoningEffort: ReasoningEffortId('high') })
    expect(ctx.modelSwitch.currentMainSelection()).toEqual({ provider: 'codex', model: 'gpt', reasoningEffort: 'high' })
    expect((ctx.settings as MemorySettings).document['agent-default-model']).toEqual({ provider: 'codex', model: 'gpt', reasoningEffort: 'high' })

    disposeAdapter()
    await runtimeFiber.dispose()
    expect(ctx.get('modelSwitch')).toBeUndefined()
    await expect(ctx.web.search({ query: 'after disposal' })).rejects.toMatchObject({ code: 'WEB_PROVIDER_CONFIGURED_MISSING' })
    await expect(ctx.settings.update(MODEL_SWITCH_SETTINGS_NAMESPACE, { searchModel: 'after-dispose' })).rejects.toThrow()
    await webFiber.dispose()
    await mainFiber.dispose()
    await settingsFiber.dispose()
  })
})
