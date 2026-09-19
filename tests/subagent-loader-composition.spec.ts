import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context, Service } from '@deepseek-ai/cordis'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { SessionId } from '@deepseek-ai/dsh-session'
import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import OfficialSubagentRuntime, { type ResolvedSubagentStartRequest, type SubagentCapabilities, type SubagentProvider, type SubagentRun } from '@deepseek-ai/dsh-subagent'
import * as SubagentSpawn from '@deepseek-ai/dsh-subagent-spawn-in-process'
import profileSubagentRuntime, { ModelSwitchSubagentRuntime } from '../src/subagent-runtime.js'
import type { Config } from '../src/host-settings.js'
import type { ModelSelection } from '../src/capabilities.js'

let ctx: Context | undefined
let root: string | undefined

afterEach(async () => {
  await ctx?.fiber.dispose()
  ctx = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

class TestModelSwitch extends Service {
  static inject = []
  settings: Config = { subagentMode: 'follow-main' }
  constructor(context: Context) { super(context, 'modelSwitch') }
  currentSettings(): Config { return { ...this.settings } }
}

async function loadComposition(): Promise<Context> {
  const context = new Context()
  ctx = context
  await context.plugin(TestModelSwitch)
  await context.plugin(profileSubagentRuntime)
  return context
}

function parentWithRoute(route?: ModelSelection) {
  const session = {
    requestHeader: () => route === undefined ? undefined : { config: route },
  }
  return { options: {}, session } as never
}

async function registerCapture(context: Context, provider: Omit<SubagentProvider, 'name'>): Promise<void> {
  const plugin = Object.assign((pluginContext: Context) => {
    pluginContext.subagents.registerProvider({ ...provider, name: 'capture' })
  }, { inject: ['subagents'] })
  await context.plugin(plugin)
}

function successfulRun(_request: ResolvedSubagentStartRequest): SubagentRun {
  return {
    id: SessionId('one-shot-child') as never,
    localAgent: undefined,
    result: Promise.resolve({ stopReason: 'completed', output: [] }),
    dispose: async () => {},
  }
}

const routingCapabilities: SubagentCapabilities = {
  agentOptions: true,
  outputSchema: false,
  depthLimit: false,
  toolFilter: false,
  persona: false,
}

const processWorkerCapabilities: SubagentCapabilities = {
  agentOptions: false,
  outputSchema: false,
  depthLimit: false,
  toolFilter: false,
  persona: false,
}

describe('public profile-patched Subagent replacement', () => {
  it('does not inject a route when Default Subagent is unset', async () => {
    const context = await loadComposition()
    expect(context.subagents).toBeInstanceOf(ModelSwitchSubagentRuntime)

    let observed: ResolvedSubagentStartRequest | undefined
    const provider: Omit<SubagentProvider, 'name'> = {
      capabilities: routingCapabilities,
      inheritsParentContext: true,
      start: async (request) => { observed = request; return successfulRun(request) },
    }
    await registerCapture(context, provider)
    await context.subagents.start('capture', {
      prompt: [{ type: 'text', text: 'route me' }],
      parent: parentWithRoute({ provider: 'parent-provider', model: 'parent-model' }),
    })
    expect(observed?.agentOptions).toBeUndefined()
  })

  it('injects a fixed Default Subagent route before the official descriptor is created', async () => {
    const context = await loadComposition()
    ;(context.modelSwitch as unknown as TestModelSwitch).settings = {
      subagentMode: 'fixed', subagentProvider: 'fixed-provider', subagentModel: 'fixed-model',
    }
    let observed: ResolvedSubagentStartRequest | undefined
    await registerCapture(context, {
      capabilities: routingCapabilities,
      inheritsParentContext: true,
      start: async (request) => { observed = request; return successfulRun(request) },
    })
    await context.subagents.start('capture', {
      prompt: [{ type: 'text', text: 'route me' }],
      parent: parentWithRoute({ provider: 'parent-provider', model: 'parent-model' }),
    })
    expect(observed?.agentOptions).toMatchObject({ provider: 'fixed-provider', model: 'fixed-model' })
  })

  it('exposes public resolveMaxDepth on the routed runtime', async () => {
    expect(typeof Reflect.get(OfficialSubagentRuntime.prototype, 'resolveMaxDepth')).not.toBe('function')
    const context = await loadComposition()
    expect(context.subagents).toBeInstanceOf(ModelSwitchSubagentRuntime)
    const runtime = context.subagents as ModelSwitchSubagentRuntime
    expect(typeof runtime.resolveMaxDepth).toBe('function')
    expect(runtime.resolveMaxDepth('provider-managed')).toBeUndefined()
    expect(runtime.resolveMaxDepth(3)).toBe(3)
    expect(runtime.resolveMaxDepth()).toBe(1)
  })

  it('lets an explicit provider and model override fixed policy', async () => {
    const context = await loadComposition()
    ;(context.modelSwitch as unknown as TestModelSwitch).settings = {
      subagentMode: 'fixed', subagentProvider: 'fixed-provider', subagentModel: 'fixed-model',
    }
    let observed: ResolvedSubagentStartRequest | undefined
    await registerCapture(context, {
      capabilities: routingCapabilities,
      inheritsParentContext: true,
      start: async (request) => { observed = request; return successfulRun(request) },
    })
    await context.subagents.start('capture', {
      prompt: [{ type: 'text', text: 'workflow route' }],
      parent: parentWithRoute(),
      agentOptions: { provider: 'workflow-provider', model: 'workflow-model', maxTokens: 123 },
    })
    expect(observed?.agentOptions).toMatchObject({ provider: 'workflow-provider', model: 'workflow-model', maxTokens: 123 })
  })

  it('does not inject a Native route into one-shot process workers', async () => {
    const context = await loadComposition()
    let observed: ResolvedSubagentStartRequest | undefined
    await registerCapture(context, {
      capabilities: processWorkerCapabilities,
      inheritsParentContext: false,
      start: async (request) => { observed = request; return successfulRun(request) },
    })
    await context.subagents.start('capture', {
      prompt: [{ type: 'text', text: 'external worker' }],
      parent: parentWithRoute({ provider: 'parent-provider', model: 'parent-model' }),
    })
    expect(observed?.agentOptions).toBeUndefined()
  })

  it('routes a continuable child before official descriptor and Agent creation', async () => {
    const context = new Context()
    ctx = context
    root = await mkdtemp(join(tmpdir(), 'dsh-model-switch-continuable-'))
    await mountAgentLoopTestDependencies(context)
    // SessionProjectionRegistry is mounted by the 0.1.5-rc.1 testkit; a second mount double-registers sessionProjections.
    await context.plugin(JsonlSessionPersistence, { root })
    await context.plugin(AgentLoop, { agents: [] })
    await context.plugin(TestModelSwitch)
    await context.plugin(profileSubagentRuntime)
    await context.plugin(SubagentSpawn, { providerName: 'spawn' })
    // AgentLoop.create is async on the 0.1.5-rc.1 host; an unawaited call hands startContinuable a Promise without .session.
    const parent = await context.agentLoop.create(SessionId('parent'), { provider: 'parent-provider', model: 'parent-model' })
    ;(context.modelSwitch as unknown as TestModelSwitch).settings = {
      subagentMode: 'fixed', subagentProvider: 'fixed-provider', subagentModel: 'fixed-model',
    }
    const started = await context.subagents.startContinuable({
      provider: 'spawn',
      label: 'continuable child',
      request: { prompt: [{ type: 'text', text: 'route child' }], parent },
      signal: new AbortController().signal,
    })
    expect(context.agents.get(started.childId)?.options).toMatchObject({ provider: 'fixed-provider', model: 'fixed-model' })
  })
})
