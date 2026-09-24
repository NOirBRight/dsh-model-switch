/** Send-time context check and optional old-model compaction before a switched request. */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import type { PromptAssembly } from '@deepseek-ai/dsh-system-prompt'
import { renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import {
  boundContextSummary,
  createMessage,
  createUserMessage,
  type Message,
  type UserMessage,
} from '@deepseek-ai/dsh-llm'
import { canonicalHeader, type EpochHeader, type Session } from '@deepseek-ai/dsh-session'
import type { TokenMeter } from '@deepseek-ai/dsh-token-meter'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'model-switch': {
      kind: 'model-switch'
      form: 'notice'
      summary: string
    }
  }
}

/** Fraction of the target window reserved for output plus estimator error. */
const OUTPUT_RESERVE = 0.2
/** Extra tokens on top of the ratio; the meter heuristic is not exact. */
const ESTIMATE_MARGIN = 64

/** Provider and model selected for one model-routed request. */
export interface SwitchRoute {
  readonly provider: string
  readonly model: string
}

/**
 * Compare two fully specified model routes.
 * @param left - first route, if one was resolved.
 * @param right - second route, if one was resolved.
 * @returns Whether both routes identify the same provider and model.
 */
export function sameSwitchRoute(left: SwitchRoute | undefined, right: SwitchRoute | undefined): boolean {
  return left !== undefined && right !== undefined && left.provider === right.provider && left.model === right.model
}

/**
 * Decide whether a changed, complete route needs send-time context protection.
 * @param enabled - whether the user enabled send-time protection.
 * @param previous - route used by the preceding request.
 * @param selected - route assembled for the pending request.
 * @returns Whether the pending request changes its provider or model.
 */
export function shouldProtectSwitch(enabled: boolean, previous: SwitchRoute | undefined, selected: SwitchRoute | undefined): boolean {
  if (!enabled) return false
  if (previous === undefined || selected === undefined) return false
  return !sameSwitchRoute(previous, selected)
}

/**
 * Input budget for the target window. Reserves output (maxTokens or 20%) plus a
 * fixed estimator margin. `undefined` means the window cannot be used.
 * @param contextWindow - adapter-owned combined request/response capacity.
 * @param maxTokens - optional generation cap from the live agent options.
 * @returns Tokens available to the request input, or undefined for an invalid window.
 */
export function switchInputBudget(contextWindow: number, maxTokens?: number): number | undefined {
  if (!(contextWindow > 0) || !Number.isFinite(contextWindow)) return undefined
  const reserve = Math.max(Math.ceil(contextWindow * OUTPUT_RESERVE), maxTokens ?? 0) + ESTIMATE_MARGIN
  return Math.max(0, Math.floor(contextWindow - reserve))
}

/**
 * Determine whether an estimated input exceeds its target route budget.
 * @param tokens - estimated input tokens.
 * @param budget - input budget for the target window.
 * @returns Whether the budget is unusable or the estimate is too large.
 */
export function overSwitchBudget(tokens: number, budget: number): boolean {
  return !(budget > 0) || tokens > budget
}

/**
 * Build one transcript-visible Model Switch progress notice.
 * @param text - localized notice text shown in the transcript.
 * @param summary - bounded event summary for durable session metadata.
 * @returns A plugin-authored user message for the session log.
 */
export function switchNotice(text: string, summary: string): UserMessage {
  return createUserMessage({
    content: [{ type: 'text', text }],
    source: { kind: 'model-switch', form: 'notice', summary: boundContextSummary(summary) },
  })
}

/**
 * Extract a complete route from partial request configuration.
 * @param value - candidate provider and model values.
 * @returns A complete route, or undefined when either identifier is absent.
 */
export function routeOf(value: { provider?: string; model?: string } | undefined): SwitchRoute | undefined {
  if (value === undefined || value.provider === undefined || value.provider.length === 0 || value.model === undefined || value.model.length === 0) return undefined
  return { provider: value.provider, model: value.model }
}

/**
 * Install send-time switch protection on the host context.
 * @param ctx - host context that owns agent-loop, llm, and tokenMeter.
 * @param settings - live Model Switch settings; `compactOnSwitch !== false` is on.
 * @param roleOf - provider-role lookup used to exclude native Agent runtimes.
 */
export function installSwitchCompaction(
  ctx: Context,
  settings: () => { compactOnSwitch?: boolean },
  roleOf: (provider: string) => 'llm' | 'agent' | undefined = () => undefined,
): void {
  const assemblies = new WeakMap<Agent, PromptAssembly>()
  let stopGate: (() => void) | undefined
  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const assembled = await next()
    if (context.agent !== undefined) {
      assemblies.set(context.agent, assembled)
      // Wrap per-session guards too: their admitted notices/context count toward the budget.
      stopGate?.()
      installGate()
    }
    return assembled
  })
  function installGate(): void {
    stopGate = ctx.on('agent/pre-step', async ({ agent, messages, signal }, next) => {
      const decision = await next()
      if (decision.kind !== 'enter' || signal.aborted) return decision
      const enabled = settings().compactOnSwitch !== false
      const previous = routeOf(agent.session.requestHeader()?.config)
      const assembly = assemblies.get(agent)
      const selected = routeOf(assembly === undefined ? undefined : {
        ...(assembly.variables.provider === undefined ? {} : { provider: assembly.variables.provider }),
        ...(assembly.variables.model === undefined ? {} : { model: assembly.variables.model }),
      })
      if (!shouldProtectSwitch(enabled, previous, selected) || previous === undefined || selected === undefined) return decision
      if (roleOf(previous.provider) === 'agent' || roleOf(selected.provider) === 'agent') return decision
      return protectSwitch(ctx, agent, previous, selected, assembly, decision, messages, signal)
    }, { prepend: true })
  }
}

async function protectSwitch(
  ctx: Context,
  agent: Agent,
  previous: SwitchRoute,
  selected: SwitchRoute,
  assembly: PromptAssembly | undefined,
  decision: Extract<PreStepDecision, { kind: 'enter' }>,
  claimed: readonly UserMessage[],
  signal: AbortSignal,
): Promise<PreStepDecision> {
  const session = agent.session
  const notice = (text: string, summary: string): void => {
    session.append('user/message', switchNotice(text, summary), { surfaceOp: 'append' })
  }
  const reject = (reason: string, summary: string, compacted: boolean): Extract<PreStepDecision, { kind: 'reject' }> => {
    notice(compacted
      ? `无法继续本次模型切换：压缩已发生，但请求未继续（${reason}）。`
      : `无法继续本次模型切换：${reason}`, summary)
    retainUserClaims(session, claimed)
    return { kind: 'reject' }
  }
  notice('正在检查上下文…', 'checking context')
  if (assembly === undefined) return reject('无法确定本次请求组装的目标模型。', 'switch blocked: no assembled target', false)

  const llm = ctx.get('llm', false) as { resolveModelInfo?(provider: string, model: string, signal?: AbortSignal): Promise<{ context?: { contextWindow?: number } }> } | undefined
  if (llm?.resolveModelInfo === undefined) return reject('无法确定目标模型的上下文窗口。', 'switch blocked: unknown window', false)
  let window: number | undefined
  try {
    const info = await llm.resolveModelInfo(selected.provider, selected.model, signal)
    const value = info.context?.contextWindow
    window = typeof value === 'number' && value > 0 ? value : undefined
  } catch {
    // Missing adapter or lookup failure is an unknown window, not a thrown send.
    window = undefined
  }
  if (signal.aborted) return reject('已取消。', 'switch blocked: cancelled', false)
  if (window === undefined) return reject('无法确定目标模型的上下文窗口。', 'switch blocked: unknown window', false)

  const meter = ctx.get('tokenMeter', false) as TokenMeter | undefined
  if (meter === undefined || typeof meter.measure !== 'function' || typeof meter.estimateMessage !== 'function') {
    return reject('无法估算待发上下文（缺少 token 计量）。', 'switch blocked: no token meter', false)
  }

  const header = targetHeader(selected, assembly)
  // The previous envelope carries the provider's own usage anchor; the target
  // envelope has none, because the switch changes the header.
  const previousHeader = session.requestHeader()
  let pressure: number
  try {
    pressure = estimateSwitchPressure(meter, session, header, assembly, decision.messages, previousHeader)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return reject(`无法估算待发上下文（${reason}）。`, 'switch blocked: estimate failed', false)
  }

  const budget = agent.options.maxTokens === undefined
    ? switchInputBudget(window)
    : switchInputBudget(window, agent.options.maxTokens)
  if (budget === undefined) return reject('无法确定目标模型的上下文窗口。', 'switch blocked: unknown window', false)
  const passed = switchNotice('上下文容量检查通过，无需压缩。', 'context check passed')
  const completed = switchNotice('压缩完成，复查通过。', 'compacted')
  if (!overSwitchBudget(pressure + meter.estimateMessage(passed), budget)) {
    session.append('user/message', passed, { surfaceOp: 'append' })
    return decision
  }

  let fixedPressure: number
  try {
    fixedPressure = estimateFixedInput(meter, session, header, assembly, decision.messages)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return reject(`无法估算待发上下文（${reason}）。`, 'switch blocked: estimate failed', false)
  }
  if (overSwitchBudget(fixedPressure + meter.estimateMessage(completed), budget)) {
    return reject('新消息或固定请求内容已超过目标模型可用容量。', 'switch blocked: fixed input oversized', false)
  }

  notice('当前上下文超过目标模型可用容量，正在使用旧模型压缩…', 'compacting with previous model')
  const compactionGeneration = session.surface.replaceGeneration
  let compacted = false
  try {
    const result = await compactWithPrevious(ctx, agent, previous, signal)
    // context-overflow compaction may prune tool results before the summary
    // call. That model-free replacement is durable even when summarization
    // subsequently fails, so retain it in the failure notice.
    compacted = result !== 'none' || session.surface.replaceGeneration > compactionGeneration
    if (result === 'none') return reject('没有可压缩的历史。', 'switch blocked: nothing to compact', compacted)
  } catch (error) {
    compacted = compacted || session.surface.replaceGeneration > compactionGeneration
    if (signal.aborted) return reject('已取消。', 'switch blocked: cancelled', compacted)
    const reason = error instanceof Error ? error.message : String(error)
    return reject(`压缩失败（${reason}）。`, 'switch blocked: compact failed', compacted)
  }
  if (signal.aborted) return reject('已取消。', 'switch blocked: cancelled', compacted)

  let again: number
  try {
    again = estimateSwitchPressure(meter, session, header, assembly, decision.messages)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return reject(`压缩后无法复查（${reason}）。`, 'switch blocked: remeasure failed', compacted)
  }
  if (overSwitchBudget(again + meter.estimateMessage(completed), budget)) {
    return reject('压缩后仍超过目标模型可用容量。', 'switch blocked: still over budget', compacted)
  }
  session.append('user/message', completed, { surfaceOp: 'append' })
  return decision
}

function targetHeader(selected: SwitchRoute, assembly: PromptAssembly): EpochHeader {
  return canonicalHeader({
    config: { provider: selected.provider, model: selected.model },
    ...(assembly.tools.length > 0 ? { tools: [...assembly.tools] } : {}),
  })
}

/**
 * Next-request input under the target route. Uses the committed surface priced
 * for the target (including image tokens), then adds still-pending enter
 * messages and the prospective system prompt while dropping already-priced
 * system nodes so they are not counted twice.
 *
 * The target envelope has no provider usage of its own, so the meter can only
 * price it with the chars-per-token heuristic. That heuristic is unconservative
 * for dense text (base64 payloads, minified sources, CJK). The previous
 * envelope holds the provider's reported usage for the same surface, so the
 * switch takes the larger of the two prices: the anchor keeps the check
 * truthful exactly where a switch makes the heuristic weakest.
 *
 * @param meter - replay token meter.
 * @param session - session being measured.
 * @param header - target request envelope.
 * @param assembly - prospective prompt assembly.
 * @param pending - messages the pre-step is about to enter.
 * @param previousHeader - envelope of the last request, when the session has one.
 * @returns Estimated next-request input tokens.
 */
function estimateSwitchPressure(
  meter: TokenMeter,
  session: Session,
  header: EpochHeader,
  assembly: PromptAssembly,
  pending: readonly Message[],
  previousHeader?: EpochHeader,
): number {
  const estimate = routePressure(meter, session, header, assembly, pending)
  if (previousHeader === undefined) return estimate
  return Math.max(estimate, routePressure(meter, session, previousHeader, assembly, pending))
}

/**
 * Price one request envelope against the committed surface.
 * @param meter - replay token meter.
 * @param session - session being measured.
 * @param header - request envelope to price.
 * @param assembly - prospective prompt assembly.
 * @param pending - messages the pre-step is about to enter.
 * @returns Estimated input tokens for that envelope.
 */
function routePressure(
  meter: TokenMeter,
  session: Session,
  header: EpochHeader,
  assembly: PromptAssembly,
  pending: readonly Message[],
): number {
  const measured = meter.measure(session, header)
  let systemTokens = 0
  for (const node of measured.nodes) {
    const event = session.eventAt(node.seq)
    if (event?.type === 'system/message') systemTokens += node.tokens
  }
  return measured.totalTokens - systemTokens + systemPromptTokens(meter, assembly) + pendingTokens(meter, pending)
}

function estimateFixedInput(meter: TokenMeter, session: Session, header: EpochHeader, assembly: PromptAssembly, pending: readonly Message[]): number {
  const measured = meter.measure(session, header)
  return measured.totalTokens - measured.surfaceTokens + systemPromptTokens(meter, assembly) + pendingTokens(meter, pending)
}

function pendingTokens(meter: TokenMeter, messages: readonly Message[]): number {
  let total = 0
  for (const message of messages) {
    const tokens = meter.estimateMessage(message)
    if (!(tokens >= 0) || !Number.isFinite(tokens)) throw new Error('pending message token estimate is not a number')
    total += tokens
  }
  return total
}

function systemPromptTokens(meter: TokenMeter, assembly: PromptAssembly): number {
  const text = renderPrompt(assembly)
  if (text.length === 0) return 0
  return meter.estimateMessage(createMessage({
    role: 'system',
    content: [{ type: 'text', text }],
    source: { kind: 'system-prompt' },
  }))
}

function retainUserClaims(session: Session, claimed: readonly UserMessage[]): void {
  for (const message of claimed) {
    if (message.source.kind !== 'user') continue
    session.append('user/message', message, { surfaceOp: 'append' })
  }
}

async function compactWithPrevious(
  ctx: Context,
  agent: Agent,
  previous: SwitchRoute,
  signal: AbortSignal,
): Promise<'compacted' | 'none'> {
  const isolated = ctx.isolate('compaction')
  const loaded = await import('@deepseek-ai/dsh-compaction-basic')
  const Engine = loaded.default
  const fiber = isolated.plugin(Engine, {
    auto: false,
    summarizationProvider: previous.provider,
    summarizationModel: previous.model,
    compactionRetries: 0,
  })
  try {
    await fiber
    const engine = isolated.get('compaction', false)
    if (engine === undefined) throw new Error('private compaction engine is unavailable')
    const result = await engine.compactIfNeeded(agent, 'context-overflow', signal)
    return result === null ? 'none' : 'compacted'
  } finally {
    await fiber.dispose()
  }
}
