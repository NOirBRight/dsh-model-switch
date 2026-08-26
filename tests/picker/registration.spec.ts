import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => {
  const Stub = () => null
  return {
    Button: Stub, Input: Stub, Toast: Stub, MarkdownText: Stub,
    IconCheckOutline16: Stub, IconChevronDownOutline14: Stub, IconChevronLeftOutline14: Stub,
    IconChevronRightOutline14: Stub, IconCloseOutline16: Stub, IconSearchOutline16: Stub, IconWarningOutline16: Stub,
  }
})

import { installComposerPicker } from '../../src/client/picker/install.tsx'

function bench() {
  const entries: Array<{ spec: Record<string, unknown>, component: unknown }> = []
  const injections: string[][] = []
  const directory = {
    store: { subscribe: vi.fn(), getSnapshot: vi.fn() },
    load: vi.fn(async () => undefined),
    select: vi.fn(async () => undefined),
  }
  const ctx: Record<string, unknown> = {
    locale: { register: vi.fn(() => () => undefined) },
    slots: {
      inject: (_name: string, register: () => unknown) => register(),
      register: (spec: Record<string, unknown>, component: unknown) => {
        entries.push({ spec, component })
        return () => undefined
      },
    },
    modelDirectories: { directoryFor: vi.fn(() => directory) },
    sessions: { subagentAddress: vi.fn(() => undefined) },
    effect: (register: () => unknown) => register(),
  }
  ctx.inject = (services: string[], register: (scope: unknown) => unknown) => {
    injections.push([...services])
    return register(ctx)
  }
  installComposerPicker(ctx as never)
  return { entries, injections }
}

describe('composer picker seat ownership', () => {
  it('uses the official model-seat service gate and an unambiguous winning priority', () => {
    const { entries, injections } = bench()
    expect(injections).toContainEqual(['slots', 'modelDirectories'])
    expect(entries.find(({ spec }) => spec.name === 'conversation.input.model')?.spec.priority).toBe(-10)
  })
})
