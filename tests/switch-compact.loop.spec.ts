import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { installModelSelection, type ModelSelection } from '@deepseek-ai/dsh-agent'
import { ModelSwitchAdapterRegistry } from '../src/adapter-registry.ts'
import { mountAgentLoopTestDependencies, mountAgentLoopTestHarness } from '@deepseek-ai/dsh-agent-loop-testkit'
import BasicCompactionEngine from '@deepseek-ai/dsh-compaction-basic'
import { LlmAdapter, createUserMessage, type GenerateOptions, type LlmResolvedModelInfo, type StreamChunk, type TokenUsage } from '@deepseek-ai/dsh-llm'
import { SessionId, Session, type SessionEvent } from '@deepseek-ai/dsh-session'
import TokenMeter from '@deepseek-ai/dsh-token-meter'
import { installSwitchCompaction, switchInputBudget } from '../src/switch-compact.ts'

class SwitchAdapter extends LlmAdapter {
  readonly calls: { model: string; summary: boolean; notices: string[]; pressure: number | undefined }[] = []
  measurePressure?: () => number
  providerUsage?: TokenUsage
  summaryText = '## Primary Request and Intent\n- keep going'
  failSummary = false
  session: Session | undefined
  constructor(private readonly windows: Record<string, number>) {
    super()
  }
  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    const contextWindow = this.windows[model]
    return Promise.resolve({
      provider,
      id: model,
      name: model,
      ...(contextWindow === undefined ? {} : { context: { contextWindow } }),
    })
  }
  async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const summary = isSummaryCall(options)
    this.calls.push({ model: options.model, summary, notices: pluginNoticeTexts(this.session), pressure: this.measurePressure?.() })
    if (summary && this.failSummary) throw new Error('summary boom')
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: summary ? this.summaryText : 'ok' } }
    if (this.providerUsage !== undefined && !summary) yield { type: 'usage', usage: this.providerUsage }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

function isSummaryCall(options: GenerateOptions): boolean {
  return options.messages.some(message => message.content.some(block => block.type === 'text' && block.text.includes('compaction engine')))
}

function pluginNoticeTexts(session: Session | undefined): string[] {
  if (session === undefined) return []
  const texts: string[] = []
  for (const event of session.snapshotEvents()) {
    if (event.type !== 'user/message') continue
    const message = event.data
    if (message.source.kind !== 'plugin' || message.source.plugin !== 'model-switch') continue
    const block = message.content[0]
    if (block?.type === 'text') texts.push(block.text)
  }
  return texts
}

function userTexts(session: Session): string[] {
  const texts: string[] = []
  for (const event of session.snapshotEvents()) {
    if (event.type !== 'user/message') continue
    const message = event.data
    if (message.source.kind !== 'user') continue
    const block = message.content[0]
    if (block?.type === 'text') texts.push(block.text)
  }
  return texts
}

function modelSelectionNotices(session: Session): SessionEvent[] {
  return session.snapshotEvents().filter(event => {
    if (event.type !== 'user/message') return false
    return event.data.source.kind === 'plugin' && event.data.source.plugin === 'model-selection'
  })
}

function prompt(text: string) {
  return createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } })
}

const disposers: Array<() => Promise<unknown>> = []
afterEach(async () => { for (const dispose of disposers.splice(0).reverse()) await dispose() })

async function startLoop(options: {
  compactOnSwitch?: boolean
  failSummary?: boolean
  windows?: Record<string, number>
  globalSummarizer?: string
  native?: boolean
  providerUsage?: TokenUsage
}) {
  const ctx = new Context()
  disposers.push(async () => {
    const fibers = [...ctx.registry.values()].flatMap(runtime => [...runtime.fibers]).reverse()
    for (const fiber of fibers) await fiber.dispose()
  })
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(TokenMeter)
  const globalSummarizer = options.globalSummarizer ?? 'GLOBAL-SHOULD-NOT-RUN'
  await ctx.plugin(BasicCompactionEngine, {
    auto: true,
    summarizationProvider: 'mock',
    summarizationModel: globalSummarizer,
  })
  const settings = { compactOnSwitch: options.compactOnSwitch !== false }
  const adapters = new ModelSwitchAdapterRegistry()
  if (options.native) adapters.register({ provider: 'mock', role: 'agent' })
  await ctx.plugin(scope => installSwitchCompaction(scope, () => settings, provider => adapters.get(provider)?.role))
  const adapter = new SwitchAdapter(options.windows ?? { big: 8000, small: 512, other: 8000 })
  if (options.providerUsage !== undefined) adapter.providerUsage = options.providerUsage
  if (options.failSummary === true) adapter.failSummary = true
  ctx.llm.registerAdapter(['mock'], adapter)
  const harness = await mountAgentLoopTestHarness(ctx)
  const agent = await harness.create(SessionId('switch-compact-loop'), { provider: 'mock', model: 'big' })
  adapter.session = agent.session
  adapter.measurePressure = () => ctx.tokenMeter.measure(agent.session).totalTokens
  const selection = {
    current: { provider: 'mock', model: 'big' } as ModelSelection,
    assembled: undefined as ModelSelection | undefined,
  }
  installModelSelection(agent.ctx, selection)
  return { ctx, agent, adapter, selection, settings, harness }
}

describe('send-time switch protection through the real agent loop', () => {
  it('does no work for picker-only changes and retries retained input after a rejected send', async () => {
    const { agent, adapter, selection } = await startLoop({ failSummary: true })
    agent.followup(prompt('history ' + 'x'.repeat(2400)))
    await agent.whenIdle()
    const events = agent.session.snapshotEvents().length
    const calls = adapter.calls.length
    selection.current = { provider: 'mock', model: 'small' }
    await Promise.resolve()
    expect(agent.session.snapshotEvents()).toHaveLength(events)
    expect(adapter.calls).toHaveLength(calls)
    agent.followup(prompt('retain me for retry'))
    await agent.whenIdle()
    expect(adapter.calls.some(call => call.model === 'small')).toBe(false)
    adapter.failSummary = false
    agent.followup(prompt('retry'))
    await agent.whenIdle()
    expect(adapter.calls.some(call => call.model === 'small' && !call.summary)).toBe(true)
    expect(userTexts(agent.session)).toContain('retain me for retry')
    expect(modelSelectionNotices(agent.session)).toHaveLength(1)
  })

  it('publishes progress before compaction completes and restores the same ordered notices', async () => {
    const { ctx, agent, adapter, selection } = await startLoop({})
    agent.followup(prompt('history ' + 'x'.repeat(2400)))
    await agent.whenIdle()
    const live: string[] = []
    ctx.on('session/event', (session, event) => {
      if (session !== agent.session || event.type !== 'user/message' || event.data.source.kind !== 'plugin') return
      if (event.data.source.plugin !== 'model-switch' && event.data.source.plugin !== 'model-selection') return
      for (const block of event.data.content) if (block.type === 'text') live.push(block.text)
    })
    let release!: () => void
    let began!: () => void
    const started = new Promise<void>(resolve => { began = resolve })
    const wait = new Promise<void>(resolve => { release = resolve })
    const stream = adapter.stream.bind(adapter)
    adapter.stream = async function* (options: GenerateOptions) {
      if (isSummaryCall(options)) { began(); await wait }
      yield* stream(options)
    }
    selection.current = { provider: 'mock', model: 'small' }
    agent.followup(prompt('continue'))
    await started
    try {
      expect(live).toEqual(['正在检查上下文…', '当前上下文超过目标模型可用容量，正在使用旧模型压缩…'])
    } finally { release() }
    await agent.whenIdle()
    expect(live).toEqual([
      '正在检查上下文…',
      '当前上下文超过目标模型可用容量，正在使用旧模型压缩…',
      '压缩完成，复查通过。',
      '[model changed: assistant turns above this point were generated by big; the session continues with small]',
    ])
    const restored = Session.create(agent.session.id, JSON.parse(JSON.stringify(agent.session.snapshotEvents())))
    expect(pluginNoticeTexts(restored)).toEqual(live.slice(0, 3))
    expect(modelSelectionNotices(restored)).toHaveLength(1)
  })

  it('does not send the target when the summary provides no effective reduction', async () => {
    const { agent, adapter, selection } = await startLoop({})
    agent.followup(prompt('history ' + 'x'.repeat(2400)))
    await agent.whenIdle()
    adapter.summaryText = 'unreduced '.repeat(500)
    selection.current = { provider: 'mock', model: 'small' }
    agent.followup(prompt('continue'))
    await agent.whenIdle()
    expect(adapter.calls.filter(call => call.summary)).toHaveLength(1)
    expect(adapter.calls.some(call => call.model === 'small' && !call.summary)).toBe(false)
    expect(pluginNoticeTexts(agent.session).at(-1)).toContain('summary is not smaller')
  })

  it('keeps concurrent sessions on their own assembled routes and compaction engines', async () => {
    const { agent, adapter, selection, harness } = await startLoop({ windows: { big: 8000, other: 8000, small: 512, tiny: 512 } })
    const second = await harness.create(SessionId('parallel-switch'), { provider: 'mock', model: 'other' })
    const secondSelection = { current: { provider: 'mock', model: 'other' } as ModelSelection, assembled: undefined as ModelSelection | undefined }
    installModelSelection(second.ctx, secondSelection)
    agent.followup(prompt('first history ' + 'x'.repeat(2400)))
    second.followup(prompt('second history ' + 'y'.repeat(2400)))
    await Promise.all([agent.whenIdle(), second.whenIdle()])
    adapter.calls.length = 0
    const stream = adapter.stream.bind(adapter)
    let entered = 0
    let release!: () => void
    const both = new Promise<void>(resolve => { release = resolve })
    adapter.stream = async function* (options: GenerateOptions) {
      if (isSummaryCall(options)) {
        if (++entered === 2) release()
        await both
      }
      yield* stream(options)
    }
    selection.current = { provider: 'mock', model: 'small' }
    secondSelection.current = { provider: 'mock', model: 'tiny' }
    agent.followup(prompt('first continue'))
    second.followup(prompt('second continue'))
    await Promise.all([agent.whenIdle(), second.whenIdle()])
    expect(adapter.calls.filter(call => call.summary).map(call => call.model).sort()).toEqual(['big', 'other'])
    expect(adapter.calls.filter(call => !call.summary).map(call => call.model).sort()).toEqual(['small', 'tiny'])
    expect(modelSelectionNotices(agent.session)).toHaveLength(1)
    expect(modelSelectionNotices(second.session)).toHaveLength(1)
  })

  it('does not compact a declared native Agent even when it advertises a context window', async () => {
    const { agent, adapter, selection } = await startLoop({ native: true })
    agent.followup(prompt('history ' + 'x'.repeat(2400)))
    await agent.whenIdle()
    selection.current = { provider: 'mock', model: 'small' }
    agent.followup(prompt('continue natively'))
    await agent.whenIdle()
    expect(adapter.calls.some(call => call.model === 'small' && !call.summary)).toBe(true)
    expect(adapter.calls.some(call => call.summary)).toBe(false)
    expect(pluginNoticeTexts(agent.session)).toEqual([])
  })

  it('compacts with the previous model, shows in-flight notices, and requests the assembled target', async () => {
    const { ctx, agent, adapter, selection } = await startLoop({})
    const history = 'keep this history ' + 'x'.repeat(2400)
    agent.followup(prompt(history))
    await agent.whenIdle()
    expect(adapter.calls.some(call => call.model === 'big' && !call.summary)).toBe(true)

    const globalModel = ctx.compaction.config.summarizationModel
    selection.current = { provider: 'mock', model: 'small' }
    const next = 'please continue'
    agent.followup(prompt(next))
    await agent.whenIdle()

    const notices = pluginNoticeTexts(agent.session)
    expect(notices[0]).toBe('正在检查上下文…')
    expect(notices).toContain('当前上下文超过目标模型可用容量，正在使用旧模型压缩…')
    expect(notices.at(-1)).toBe('压缩完成，复查通过。')
    const compact = adapter.calls.find(call => call.summary)
    expect(compact?.model).toBe('big')
    expect(compact?.notices.some(text => text.includes('正在检查') || text.includes('正在使用旧模型压缩'))).toBe(true)
    expect(adapter.calls.some(call => call.model === 'small' && !call.summary)).toBe(true)
    expect(adapter.calls.some(call => call.model === 'GLOBAL-SHOULD-NOT-RUN')).toBe(false)
    expect(ctx.compaction.config.summarizationModel).toBe(globalModel)
    expect(adapter.calls.find(call => call.model === 'small' && !call.summary)?.pressure).toBeLessThanOrEqual(switchInputBudget(512)!)
    expect(modelSelectionNotices(agent.session)).toHaveLength(1)
    expect(pluginNoticeTexts(agent.session).filter(text => text.includes('model changed'))).toHaveLength(0)
    expect(userTexts(agent.session)).toContain(next)
  }, 30_000)

  it('includes the completion notice in the final admitted request budget', async () => {
    const { agent, adapter, selection } = await startLoop({ windows: { big: 8000, small: 330 } })
    agent.followup(prompt('history ' + 'x'.repeat(2400)))
    await agent.whenIdle()
    selection.current = { provider: 'mock', model: 'small' }
    agent.followup(prompt('please continue'))
    await agent.whenIdle()
    const target = adapter.calls.find(call => call.model === 'small' && !call.summary)
    expect(target).toBeUndefined()
    expect(pluginNoticeTexts(agent.session).at(-1)).toContain('压缩后仍超过目标模型可用容量')
  })

  it('blocks a target that cannot fit the compacted summary and pending input', async () => {
    const { agent, adapter, selection } = await startLoop({ windows: { big: 8000, small: 256 } })
    agent.followup(prompt('history ' + 'x'.repeat(2400)))
    await agent.whenIdle()
    selection.current = { provider: 'mock', model: 'small' }
    agent.followup(prompt('keep this request'))
    await agent.whenIdle()
    expect(adapter.calls.some(call => call.summary)).toBe(true)
    expect(adapter.calls.some(call => call.model === 'small' && !call.summary)).toBe(false)
    expect(pluginNoticeTexts(agent.session).at(-1)).toContain('压缩后仍超过目标模型可用容量')
    expect(userTexts(agent.session)).toContain('keep this request')
    expect(modelSelectionNotices(agent.session)).toHaveLength(0)
  })

  it('counts the new message: history that fit still triggers protection after the send', async () => {
    const { agent, adapter, selection } = await startLoop({ windows: { big: 8000, small: 400 } })
    agent.followup(prompt('short prior'))
    await agent.whenIdle()
    adapter.calls.length = 0
    selection.current = { provider: 'mock', model: 'small' }
    const huge = 'new oversized input ' + 'y'.repeat(3000)
    agent.followup(prompt(huge))
    await agent.whenIdle()
    expect(pluginNoticeTexts(agent.session).some(text => text.includes('正在检查上下文'))).toBe(true)
    expect(pluginNoticeTexts(agent.session).some(text => text.includes('新消息或固定请求内容已超过目标模型可用容量'))).toBe(true)
    expect(adapter.calls.some(call => call.summary)).toBe(false)
    expect(adapter.calls.some(call => call.model === 'small' && !call.summary)).toBe(false)
    expect(userTexts(agent.session)).toContain(huge)
  }, 30_000)

  it('skips compaction when the target window is enough, without a duplicate switch notice', async () => {
    const { agent, adapter, selection } = await startLoop({ windows: { big: 8000, small: 8000 } })
    agent.followup(prompt('hello'))
    await agent.whenIdle()
    adapter.calls.length = 0
    selection.current = { provider: 'mock', model: 'small' }
    agent.followup(prompt('next'))
    await agent.whenIdle()
    expect(pluginNoticeTexts(agent.session)).toEqual([
      '正在检查上下文…',
      '上下文容量检查通过，无需压缩。',
    ])
    expect(adapter.calls.some(call => call.summary)).toBe(false)
    expect(adapter.calls.some(call => call.model === 'small' && !call.summary)).toBe(true)
    expect(modelSelectionNotices(agent.session)).toHaveLength(1)
  }, 30_000)

  it('keeps the claimed user message when compaction fails and does not call the target', async () => {
    const { agent, adapter, selection } = await startLoop({ failSummary: true })
    agent.followup(prompt('keep this history ' + 'x'.repeat(2400)))
    await agent.whenIdle()
    adapter.calls.length = 0
    selection.current = { provider: 'mock', model: 'small' }
    const retryable = 'do not drop me'
    agent.followup(prompt(retryable))
    await agent.whenIdle()
    expect(adapter.calls.some(call => call.model === 'small' && !call.summary)).toBe(false)
    expect(pluginNoticeTexts(agent.session).some(text => text.includes('无法继续本次模型切换'))).toBe(true)
    expect(userTexts(agent.session)).toContain(retryable)
    expect(agent.inbox.nextTurn).toHaveLength(0)
    expect(modelSelectionNotices(agent.session)).toHaveLength(0)
  }, 30_000)

  it('uses the assembled snapshot when the picker changes during compaction', async () => {
    const { agent, adapter, selection } = await startLoop({})
    agent.followup(prompt('keep this history ' + 'x'.repeat(2400)))
    await agent.whenIdle()
    const originalStream = adapter.stream.bind(adapter)
    adapter.stream = (async function* (options: GenerateOptions) {
      if (isSummaryCall(options)) selection.current = { provider: 'mock', model: 'other' }
      yield* originalStream(options)
    }) as typeof adapter.stream
    selection.current = { provider: 'mock', model: 'small' }
    agent.followup(prompt('after switch'))
    await agent.whenIdle()
    expect(adapter.calls.some(call => call.model === 'small' && !call.summary)).toBe(true)
    expect(adapter.calls.some(call => call.model === 'other' && !call.summary)).toBe(false)
  }, 30_000)

  it('does no extra work when the toggle is off or the route is unchanged', async () => {
    const off = await startLoop({ compactOnSwitch: false })
    off.agent.followup(prompt('keep this history ' + 'x'.repeat(2400)))
    await off.agent.whenIdle()
    off.adapter.calls.length = 0
    off.selection.current = { provider: 'mock', model: 'small' }
    off.agent.followup(prompt('off'))
    await off.agent.whenIdle()
    expect(pluginNoticeTexts(off.agent.session)).toEqual([])
    expect(off.adapter.calls.some(call => call.summary)).toBe(false)
    expect(off.adapter.calls.some(call => call.model === 'small')).toBe(true)

    const same = await startLoop({})
    same.agent.followup(prompt('hello'))
    await same.agent.whenIdle()
    same.adapter.calls.length = 0
    same.agent.followup(prompt('again'))
    await same.agent.whenIdle()
    expect(pluginNoticeTexts(same.agent.session)).toEqual([])
    expect(same.adapter.calls.some(call => call.summary)).toBe(false)
  }, 30_000)

  it('cancels during old-model compaction without sending the target', async () => {
    const { agent, adapter, selection } = await startLoop({})
    agent.followup(prompt('keep this history ' + 'x'.repeat(2400)))
    await agent.whenIdle()
    adapter.calls.length = 0
    const originalStream = adapter.stream.bind(adapter)
    adapter.stream = (async function* (options: GenerateOptions) {
      if (isSummaryCall(options)) agent.cancel({ kind: 'user' })
      yield* originalStream(options)
    }) as typeof adapter.stream
    selection.current = { provider: 'mock', model: 'small' }
    agent.followup(prompt('cancel me'))
    await agent.whenIdle()
    expect(adapter.calls.some(call => call.model === 'small' && !call.summary)).toBe(false)
    expect(pluginNoticeTexts(agent.session).some(text => text.includes('无法继续本次模型切换'))).toBe(true)
    expect(userTexts(agent.session)).toContain('cancel me')
    expect(modelSelectionNotices(agent.session)).toHaveLength(0)
  }, 30_000)

  it('prices the switch with the previous provider usage when the heuristic fits', async () => {
    // Dense text (base64 payloads, minified sources, CJK) prices far above the
    // meter's chars-per-token heuristic, so the target envelope alone reports
    // "fits" while the provider would see a request past its window.
    const usage = { inputTokens: 20_000, outputTokens: 1, totalTokens: 20_001 }
    const { agent, adapter, selection } = await startLoop({
      windows: { big: 100_000, small: 8_000, other: 100_000 },
      providerUsage: usage,
    })
    agent.followup(prompt('dense history ' + 'QUJD'.repeat(400)))
    await agent.whenIdle()
    adapter.calls.length = 0
    selection.current = { provider: 'mock', model: 'small' }
    agent.followup(prompt('keep this'))
    await agent.whenIdle()

    expect(adapter.calls[0]?.summary).toBe(true)
    expect(adapter.calls[0]?.model).toBe('big')
    expect(pluginNoticeTexts(agent.session)).toContain('当前上下文超过目标模型可用容量，正在使用旧模型压缩…')
    expect(userTexts(agent.session)).toContain('keep this')
  }, 30_000)

  it('rejects an unknown target window and keeps the user message', async () => {
    const { agent, adapter, selection } = await startLoop({ windows: { big: 8000 } })
    agent.followup(prompt('hello'))
    await agent.whenIdle()
    adapter.calls.length = 0
    selection.current = { provider: 'mock', model: 'ghost' }
    agent.followup(prompt('ghost send'))
    await agent.whenIdle()
    expect(adapter.calls.some(call => call.model === 'ghost' && !call.summary)).toBe(false)
    expect(pluginNoticeTexts(agent.session).some(text => text.includes('无法确定目标模型的上下文窗口'))).toBe(true)
    expect(userTexts(agent.session)).toContain('ghost send')
  }, 30_000)
})
