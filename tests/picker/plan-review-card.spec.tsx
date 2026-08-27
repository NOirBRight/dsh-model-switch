import React from 'react'
import { act, create } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'

const composerStub = vi.hoisted(() => ({ crash: false }))

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  MarkdownText: ({ text }: { text: string }) => <span>{text}</span>,
}))
vi.mock('../../src/client/picker/ComposerPicker.tsx', () => ({
  ComposerPicker: (props: { tone?: string; embedded?: boolean }) => {
    if (composerStub.crash) throw new Error('directory exploded')
    return <div data-composer-picker data-tone={props.tone} data-embedded={props.embedded === true ? 'true' : undefined} />
  },
}))

import { PlanReviewCard } from '../../src/client/picker/PlanReviewCard.tsx'
import { en, zh, type PickerKey } from '../../src/client/picker/locales.ts'

const selection = { provider: 'codex', model: 'gpt-5.6-sol' }
const baseSnapshot = { current: selection, groups: [], failures: [], status: 'ready', error: null as string | null }
function wait(respond = vi.fn(async () => ({ accepted: true })), key = 'plan-1') {
  return {
    kind: 'question', key, sessionId: 'session-1', respond,
    payload: { questions: [{
      id: 'approve-plan', question: 'Ready?', detail: '# Plan', multiSelect: false,
      intent: { kind: 'plan-review', approve: 'Approve' },
      options: [{ label: 'Approve' }, { label: 'Keep planning' }],
    }] },
  }
}
function props(overrides: Record<string, unknown> = {}) {
  let snapshot = baseSnapshot
  return {
    matched: wait() as never,
    available: true,
    useDirectory: (selector: (value: typeof baseSnapshot) => unknown) => selector(snapshot),
    getDirectorySnapshot: () => snapshot,
    setSnapshot: (next: typeof baseSnapshot) => { snapshot = next },
    load: () => undefined,
    select: vi.fn(async () => true),
    t: (key: string, params?: Record<string, string>) => params?.message === undefined ? key : `${key}: ${params.message}`,
    ...overrides,
  }
}
function approve(card: ReturnType<typeof create>, label = 'plan.approve') {
  return card.root.findAllByType('button').find(button => button.children.includes(label))!
}
function locale(dictionary: Record<PickerKey, string>) {
  return (key: PickerKey, params?: Record<string, string>) => {
    const template = dictionary[key]
    return Object.entries(params ?? {}).reduce((copy, [name, value]) => copy.replace(`{${name}}`, value), template)
  }
}

describe('PlanReviewCard', () => {
  it('keeps a localized Plan picker diagnostic mounted and retries the failed subtree', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    composerStub.crash = true
    let card!: ReturnType<typeof create>
    await act(async () => { card = create(<PlanReviewCard {...props({ t: locale(zh) }) as never} />) })
    const diagnostic = card.root.findByProps({ 'data-dsh-ms-plan-picker-error': true })
    expect(diagnostic.findByType('span').children.join('')).toBe('执行模型选择器出错：directory exploded')
    composerStub.crash = false
    await act(async () => { diagnostic.findByType('button').props.onClick() })
    expect(card.root.findByProps({ 'data-composer-picker': true })).toBeDefined()
    error.mockRestore()
  })

  it('puts a capsule execution picker on the left of the action row', async () => {
    const fixture = props({ t: locale(zh) })
    let card!: ReturnType<typeof create>
    await act(async () => { card = create(<PlanReviewCard {...fixture as never} />) })
    const picker = card.root.findByProps({ 'data-composer-picker': true })
    expect(picker.props['data-tone']).toBe('capsule')
    expect(picker.props['data-embedded']).toBe('true')
    expect(card.root.findByProps({ 'aria-label': zh['plan.execution'] })).toBeDefined()
    expect(card.root.findAllByType('button').some(button => button.children.includes(zh['plan.discuss']))).toBe(true)
    expect(card.root.findAllByType('button').some(button => button.children.includes(zh['plan.keep']))).toBe(true)
    expect(card.root.findAllByType('button').some(button => button.children.includes(zh['plan.approve']))).toBe(true)
  })

  it('keeps Approve disabled until the rendered execution picker is ready', async () => {
    const fixture = props()
    fixture.setSnapshot({ ...baseSnapshot, current: null })
    let card!: ReturnType<typeof create>
    await act(async () => { card = create(<PlanReviewCard {...fixture as never} />) })
    expect(card.root.findByProps({ 'data-composer-picker': true })).toBeDefined()
    expect(approve(card).props.disabled).toBe(true)

    fixture.setSnapshot(baseSnapshot)
    await act(async () => { card.update(<PlanReviewCard {...fixture as never} />) })
    expect(approve(card).props.disabled).toBe(false)
  })

  it('keeps a rejected approval visible, shows a localized error, and retries it', async () => {
    const respond = vi.fn(async () => ({ accepted: true }))
    const select = vi.fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
    const fixture = props({ matched: wait(respond), select, t: locale(zh) })
    fixture.setSnapshot({ ...baseSnapshot, error: null })
    let card!: ReturnType<typeof create>
    await act(async () => { card = create(<PlanReviewCard {...fixture as never} />) })

    await act(async () => { approve(card, zh['plan.approve']).props.onClick(); await Promise.resolve(); await Promise.resolve() })
    expect(card.root.findByProps({ 'data-plan-review-key': 'plan-1' })).toBeDefined()
    expect(card.root.findAllByProps({ role: 'status' }).some(node =>
      node.children.includes(zh['plan.modelFailed']),
    )).toBe(true)
    expect(approve(card, zh['plan.approve']).props.disabled).toBe(false)
    expect(respond).not.toHaveBeenCalled()

    await act(async () => { approve(card, zh['plan.approve']).props.onClick(); await Promise.resolve(); await Promise.resolve() })
    expect(select).toHaveBeenCalledTimes(2)
    expect(respond).toHaveBeenCalledTimes(1)
  })

  it('keeps a transient response failure after commit visible and retryable', async () => {
    const respond = vi.fn()
      .mockRejectedValueOnce(new Error('transport unavailable'))
      .mockResolvedValueOnce({ accepted: true })
    const select = vi.fn(async () => true)
    const fixture = props({ matched: wait(respond), select, t: locale(en) })
    let card!: ReturnType<typeof create>
    await act(async () => { card = create(<PlanReviewCard {...fixture as never} />) })

    await act(async () => { approve(card, en['plan.approve']).props.onClick(); await Promise.resolve(); await Promise.resolve() })
    expect(card.root.findAllByProps({ role: 'status' }).some(node =>
      node.children.includes('transport unavailable'),
    )).toBe(true)
    expect(approve(card, en['plan.approve']).props.disabled).toBe(false)

    await act(async () => { approve(card, en['plan.approve']).props.onClick(); await Promise.resolve(); await Promise.resolve() })
    expect(select).toHaveBeenCalledTimes(2)
    expect(respond).toHaveBeenCalledTimes(2)
  })

  it('fails closed when another client wins the non-atomic response race after commit', async () => {
    const respond = vi.fn(async () => ({ accepted: false, reason: 'already-settled' }))
    const select = vi.fn(async () => true)
    const fixture = props({ matched: wait(respond), select, t: locale(en) })
    let card!: ReturnType<typeof create>
    await act(async () => { card = create(<PlanReviewCard {...fixture as never} />) })

    await act(async () => { approve(card, en['plan.approve']).props.onClick(); await Promise.resolve(); await Promise.resolve() })
    expect(select).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledTimes(1)
    expect(approve(card, en['plan.approve']).props.disabled).toBe(true)
    expect(card.root.findAllByType('button').every(button => button.props.disabled === true)).toBe(true)
    expect(card.root.findAllByProps({ role: 'status' }).some(node =>
      node.children.includes(en['plan.responseRejected']),
    )).toBe(true)

    await act(async () => { approve(card, en['plan.approve']).props.onClick(); await Promise.resolve() })
    expect(select).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledTimes(1)
  })

  it('resets terminal action state when the registered boundary receives a different wait', async () => {
    const first = vi.fn(async () => ({ accepted: false, reason: 'already-settled' }))
    const second = vi.fn(async () => ({ accepted: true }))
    const fixture = props({ matched: wait(first, 'plan-1'), t: locale(en) })
    let card!: ReturnType<typeof create>
    await act(async () => { card = create(<PlanReviewCard {...fixture as never} />) })
    await act(async () => { approve(card, en['plan.approve']).props.onClick(); await Promise.resolve(); await Promise.resolve() })
    expect(approve(card, en['plan.approve']).props.disabled).toBe(true)

    const replacement = { ...fixture, matched: wait(second, 'plan-2') }
    await act(async () => { card.update(<PlanReviewCard {...replacement as never} />) })
    expect(card.root.findByProps({ 'data-plan-review-key': 'plan-2' })).toBeDefined()
    expect(approve(card, en['plan.approve']).props.disabled).toBe(false)
    expect(card.root.findAllByProps({ role: 'status' }).some(node => node.children.includes(en['plan.responseRejected']))).toBe(false)
    await act(async () => { approve(card, en['plan.approve']).props.onClick(); await Promise.resolve(); await Promise.resolve() })
    expect(second).toHaveBeenCalledOnce()
  })

  it('renders localized cancellation rejection and leaves the uncommitted action retryable', async () => {
    const respond = vi.fn(async () => ({ accepted: false, reason: 'already-settled' }))
    const fixture = props({ matched: wait(respond), t: locale(zh) })
    let card!: ReturnType<typeof create>
    await act(async () => { card = create(<PlanReviewCard {...fixture as never} />) })

    const discuss = card.root.findAllByType('button').find(button => button.children.includes(zh['plan.discuss']))!
    await act(async () => { discuss.props.onClick(); await Promise.resolve(); await Promise.resolve() })
    expect(respond).toHaveBeenCalledWith(expect.objectContaining({
      ok: false, error: expect.objectContaining({ message: zh['plan.cancelMessage'] }),
    }))
    expect(card.root.findAllByProps({ role: 'status' }).some(node =>
      node.children.includes(zh['plan.cancelRejected']),
    )).toBe(true)
    expect(approve(card, zh['plan.approve']).props.disabled).toBe(false)
  })

  it('starts at most one approval operation for same-tick gestures', async () => {
    let resolveCommit!: (accepted: boolean) => void
    const select = vi.fn(() => new Promise<boolean>(resolve => { resolveCommit = resolve }))
    const respond = vi.fn(async () => ({ accepted: true }))
    const fixture = props({ matched: wait(respond), select })
    let card!: ReturnType<typeof create>
    await act(async () => { card = create(<PlanReviewCard {...fixture as never} />) })

    const button = approve(card)
    await act(async () => { button.props.onClick(); button.props.onClick(); await Promise.resolve() })
    expect(select).toHaveBeenCalledTimes(1)
    expect(respond).not.toHaveBeenCalled()

    await act(async () => { resolveCommit(false); await Promise.resolve(); await Promise.resolve() })
  })

  it('cannot answer before the execution-model commit resolves', async () => {
    let resolveCommit!: (accepted: boolean) => void
    const select = vi.fn(() => new Promise<boolean>(resolve => { resolveCommit = resolve }))
    const respond = vi.fn(async () => ({ accepted: true }))
    const fixture = props({ matched: wait(respond), select })
    let card!: ReturnType<typeof create>
    await act(async () => { card = create(<PlanReviewCard {...fixture as never} />) })

    await act(async () => { approve(card).props.onClick(); await Promise.resolve() })
    expect(approve(card).props.disabled).toBe(true)
    expect(respond).not.toHaveBeenCalled()

    await act(async () => { resolveCommit(true); await Promise.resolve(); await Promise.resolve() })
    expect(select.mock.invocationCallOrder[0]).toBeLessThan(respond.mock.invocationCallOrder[0]!)
  })
})
