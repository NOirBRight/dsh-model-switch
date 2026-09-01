import { afterEach, describe, expect, it } from 'vitest'
import { Context, Service } from '@deepseek-ai/cordis'
import OfficialSubagentRuntime from '@deepseek-ai/dsh-subagent'
import {
  ModelSwitchSubagentRuntime,
  SubagentRouteUnavailableError,
  StartupIncompatibilityError,
  mountWithStartupFallback,
  profileSubagentRuntime,
} from '../src/subagent-runtime.js'

let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
})

describe('Subagent profile startup selection', () => {
  it('falls back after typed public-surface incompatibility', async () => {
    class IncompatibleModelSwitch extends Service {
      static inject = []
      constructor(ctx: Context) { super(ctx, 'modelSwitch') }
      currentSettings(): { subagentMode: 'follow-main' } { return { subagentMode: 'follow-main' } }
    }

    context = new Context()
    await context.plugin(IncompatibleModelSwitch)
    await context.plugin(profileSubagentRuntime)

    expect(context.subagents).toBeInstanceOf(OfficialSubagentRuntime)
    expect(context.subagents).not.toBeInstanceOf(ModelSwitchSubagentRuntime)
  })

  it('does not fall back for a startup TypeError', async () => {
    class ThrowingModelSwitch extends Service {
      static inject = []
      constructor(ctx: Context) { super(ctx, 'modelSwitch') }
      get currentSettings(): never { throw new TypeError('broken model switch') }
      currentMainSelection(): never { throw new Error('not reached') }
    }

    context = new Context()
    await context.plugin(ThrowingModelSwitch)
    await expect(context.plugin(profileSubagentRuntime)).rejects.toThrow('broken model switch')
    expect(context.registry.has(OfficialSubagentRuntime)).toBe(false)
  })
})

describe('typed startup fallback cleanup', () => {
  it('disposes the failed candidate before mounting the fallback', async () => {
    const events: string[] = []
    const mounted = await mountWithStartupFallback(
      async track => {
        events.push('candidate-start')
        track(async () => { events.push('candidate-cleanup') })
        throw new StartupIncompatibilityError('candidate', 'unsupported public surface')
      },
      async track => {
        events.push('fallback-start')
        track(async () => { events.push('fallback-cleanup') })
        return 'fallback'
      },
    )

    expect(mounted.value).toBe('fallback')
    expect(events).toEqual(['candidate-start', 'candidate-cleanup', 'fallback-start'])
    await mounted.dispose()
    await mounted.dispose()
    expect(events).toEqual(['candidate-start', 'candidate-cleanup', 'fallback-start', 'fallback-cleanup'])
  })

  it('does not fall back for route errors', async () => {
    let fallbackStarted = false
    await expect(mountWithStartupFallback(
      async () => { throw new SubagentRouteUnavailableError('invalid route') },
      async () => { fallbackStarted = true; return undefined },
    )).rejects.toBeInstanceOf(SubagentRouteUnavailableError)
    expect(fallbackStarted).toBe(false)
  })

  it.each([
    ['configuration', new TypeError('invalid configuration')],
    ['route', new TypeError('route failed')],
    ['provider', new TypeError('provider failed')],
    ['call', new TypeError('call failed')],
  ])('does not fall back for %s TypeError', async (_kind, failure) => {
    let fallbackStarted = false
    await expect(mountWithStartupFallback(
      async () => { throw failure },
      async () => { fallbackStarted = true; return undefined },
    )).rejects.toBe(failure)
    expect(fallbackStarted).toBe(false)
  })

  it('disposes a successful attempt in reverse order and only once', async () => {
    const events: string[] = []
    const mounted = await mountWithStartupFallback(
      async track => {
        track(async () => { events.push('cleanup-a') })
        track(async () => { events.push('cleanup-b') })
        events.push('candidate-ready')
        return 'candidate'
      },
      async () => { throw new Error('fallback must not start') },
    )

    await Promise.all([mounted.dispose(), mounted.dispose()])
    expect(events).toEqual(['candidate-ready', 'cleanup-b', 'cleanup-a'])
  })

  it('reports fallback cleanup failure without retrying disposal', async () => {
    let cleanupCount = 0
    const mounted = await mountWithStartupFallback(
      async () => { throw new StartupIncompatibilityError('candidate', 'unsupported public surface') },
      async track => {
        track(async () => { cleanupCount += 1; throw new Error('fallback cleanup failed') })
        return 'fallback'
      },
    )

    await expect(mounted.dispose()).rejects.toSatisfy(error =>
      error instanceof AggregateError
      && error.errors.length === 1
      && (error.errors[0] as Error).message === 'fallback cleanup failed',
    )
    await expect(mounted.dispose()).rejects.toSatisfy(error => error instanceof AggregateError)
    expect(cleanupCount).toBe(1)
  })

  it('keeps the startup error first and aggregates every cleanup failure', async () => {
    const events: string[] = []
    const startup = new StartupIncompatibilityError('candidate', 'unsupported public surface')
    let fallbackStarted = false
    const result = mountWithStartupFallback(
      async track => {
        track(async () => { events.push('cleanup-a'); throw new Error('cleanup-a failed') })
        track(async () => { events.push('cleanup-b'); throw new Error('cleanup-b failed') })
        throw startup
      },
      async () => { fallbackStarted = true; return undefined },
    )

    await expect(result).rejects.toSatisfy(error => {
      if (!(error instanceof AggregateError)) return false
      return error.errors[0] === startup
        && (error.errors[1] as Error).message === 'cleanup-b failed'
        && (error.errors[2] as Error).message === 'cleanup-a failed'
    })
    expect(events).toEqual(['cleanup-b', 'cleanup-a'])
    expect(fallbackStarted).toBe(false)
  })
})
