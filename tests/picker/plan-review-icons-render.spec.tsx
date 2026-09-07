import React from 'react'
import { act, create } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { PlanReviewCard } from '../../src/client/picker/PlanReviewCard.tsx'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: ({ children, icon, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode }) => (
    <button {...props}>{icon}{children}</button>
  ),
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  MarkdownText: ({ text }: { text: string }) => <span>{text}</span>,
  IconCheckOutline16: () => <svg data-stub-icon="check" />,
  IconChevronDownOutline14: () => <svg data-stub-icon="chevron-down" />,
  IconChevronLeftOutline14: () => <svg data-stub-icon="chevron-left" />,
  IconChevronRightOutline14: () => <svg data-stub-icon="chevron-right" />,
  IconCloseOutline16: () => <svg data-stub-icon="close" />,
  IconSearchOutline16: () => <svg data-stub-icon="search" />,
  IconWarningOutline16: () => <svg data-stub-icon="warning" />,
  IconEditOutline16: () => <span data-icon-edit />,
  Toast: () => null,
}))
vi.mock('../../src/client/picker/useComposerPickerSurface.ts', () => ({
  useComposerPickerSurface: () => ({
    id: 'test', open: false, menuStyle: {}, triggerRef: { current: null }, menuRef: { current: null },
    show: vi.fn(), close: vi.fn(), onTriggerPointerDown: vi.fn(), onTriggerClick: vi.fn(),
  }),
}))

const WHALE_VIEWBOX = '0 0 23.16 17.04'
const AGENT_VIEWBOX = '0 0 169 148'

function matched(key = 'plan-1') {
  return {
    kind: 'plan-review', key, sessionId: 'session-1',
    answer: async () => undefined, cancel: async () => undefined,
    questions: [{
      id: 'approve-plan', question: 'Ready?', detail: '# Plan', multiSelect: false,
      intent: { kind: 'plan-review', approve: 'Approve' },
      options: [{ label: 'Approve' }, { label: 'Keep planning' }],
    }],
  }
}

const UNLOCKED_LOCK = { provider: null, failed: false } as const
const EMPTY_ORDER: readonly string[] = []
const PLAIN_PHASE = { phase: 'plain' }

function propsFor(provider: string, roleOf?: (key: string) => string | undefined) {
  const selection = { provider, model: 'm' }
  const snapshot = {
    current: selection, routable: true,
    groups: [{ id: provider, name: provider, models: [{ id: 'm', name: 'M' }] }],
    failures: [], status: 'ready' as const, error: null,
  }
  return {
    matched: matched() as never,
    available: true,
    useDirectory: (selector: (value: typeof snapshot) => unknown) => selector(snapshot),
    useProviderOrder: (selector: (value: readonly string[]) => unknown) => selector(EMPTY_ORDER),
    useInput: (selector: (value: typeof PLAIN_PHASE) => unknown) => selector(PLAIN_PHASE),
    providerLockStore: { subscribe: () => () => undefined, getSnapshot: () => UNLOCKED_LOCK },
    refreshProviderLock: vi.fn(() => undefined),
    getDirectorySnapshot: () => snapshot,
    load: vi.fn(() => undefined),
    select: vi.fn(async () => true),
    t: (key: string) => key,
    ...(roleOf === undefined ? {} : { roleOf }),
  }
}

function runtimeViewBoxes(card: ReturnType<typeof create>): string[] {
  return card.root.findAllByType('svg')
    .map(node => node.props.viewBox as string | undefined)
    .filter((viewBox): viewBox is string => typeof viewBox === 'string')
}

const agentRoleOf = (key: string): string | undefined => key === 'antigravity' ? 'agent' : 'llm'
const llmRoleOf = (): string | undefined => 'llm'

describe('PlanReview execution picker runtime icons', () => {
  it('shows the own Agent mark for the native Antigravity execution model', async () => {
    let card!: ReturnType<typeof create>
    await act(async () => { card = create(<PlanReviewCard {...propsFor('antigravity', agentRoleOf) as never} />) })
    const boxes = runtimeViewBoxes(card)
    expect(boxes).toContain(AGENT_VIEWBOX)
    expect(boxes).not.toContain(WHALE_VIEWBOX)
  })

  it('shows the DSH whale for a DSH-owned LLM execution model', async () => {
    let card!: ReturnType<typeof create>
    await act(async () => { card = create(<PlanReviewCard {...propsFor('codex', llmRoleOf) as never} />) })
    const boxes = runtimeViewBoxes(card)
    expect(boxes).toContain(WHALE_VIEWBOX)
    expect(boxes).not.toContain(AGENT_VIEWBOX)
  })
})
