import React from 'react'
import { act, create } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'

const nextDraft = { provider: 'ollama', model: 'qwen3' }
let pickerProps: Record<string, unknown> = {}
vi.mock('../../src/client/picker/ComposerPicker.tsx', () => ({
  ComposerPicker: (props: Record<string, unknown> & { onDraftChange?: (selection: typeof nextDraft) => void }) => {
    pickerProps = props
    return <button data-visible-picker onClick={() => { props.onDraftChange?.(nextDraft) }}>picker</button>
  },
}))

import { ContinueInDshAdapter } from '../../src/client/picker/ContinueInDshAdapter.tsx'

const initial = { provider: 'codex', model: 'gpt-5.6-sol' }
const snapshot = { current: initial, groups: [], failures: [], status: 'ready', error: null }

function base(overrides: Record<string, unknown> = {}) {
  return {
    locked: false,
    targets: [],
    targetsLabel: 'External Agents',
    selectedTarget: 'dsh',
    selectTarget: vi.fn(),
    registerCommit: vi.fn(),
    available: true,
    useDirectory: (selector: (value: typeof snapshot) => unknown) => selector(snapshot),
    getDirectorySnapshot: () => snapshot,
    load: vi.fn(),
    select: vi.fn(async () => true),
    t: (key: string) => key,
    ...overrides,
  }
}

describe('ContinueInDshAdapter rendered contribution', () => {
  it('owns the draft and registers a commit that selects it before the owner responds', async () => {
    let commit: (() => Promise<boolean>) | null = null
    const registerCommit = vi.fn((next: (() => Promise<boolean>) | null) => {
      commit = next
      return () => { if (commit === next) commit = null }
    })
    const select = vi.fn(async () => true)
    const selectTarget = vi.fn()
    const props = base({ registerCommit, select, selectTarget })
    let card!: ReturnType<typeof create>
    await act(async () => { card = create(<ContinueInDshAdapter {...props as never} />) })

    expect(commit).toBeTypeOf('function')
    await expect(commit!()).resolves.toBe(true)
    expect(select).toHaveBeenLastCalledWith(initial)
    expect(pickerProps).not.toHaveProperty('select')

    await act(async () => { card.root.findByProps({ 'data-visible-picker': true }).props.onClick() })
    expect(pickerProps).toHaveProperty('draft', nextDraft)
    expect(selectTarget).toHaveBeenCalledWith('dsh')
    await expect(commit!()).resolves.toBe(true)
    expect(select).toHaveBeenLastCalledWith(nextDraft)

    await act(async () => { card.unmount() })
    expect(commit).toBeNull()
  })

  it('preserves its draft when a same-Plan owner recreates the registration callback', async () => {
    let firstCommit: (() => Promise<boolean>) | null = null
    let secondCommit: (() => Promise<boolean>) | null = null
    const firstRegister = (next: (() => Promise<boolean>) | null) => {
      firstCommit = next
      return () => { if (firstCommit === next) firstCommit = null }
    }
    const secondRegister = (next: (() => Promise<boolean>) | null) => {
      secondCommit = next
      return () => { if (secondCommit === next) secondCommit = null }
    }
    const select = vi.fn(async () => true)
    let card!: ReturnType<typeof create>
    await act(async () => { card = create(<ContinueInDshAdapter {...base({ registerCommit: firstRegister, select }) as never} />) })
    await act(async () => { card.root.findByProps({ 'data-visible-picker': true }).props.onClick() })
    expect(pickerProps).toHaveProperty('draft', nextDraft)

    await act(async () => { card.update(<ContinueInDshAdapter {...base({ registerCommit: secondRegister, select }) as never} />) })
    expect(firstCommit).toBeNull()
    expect(secondCommit).toBeTypeOf('function')
    expect(pickerProps).toHaveProperty('draft', nextDraft)
    await expect(secondCommit!()).resolves.toBe(true)
    expect(select).toHaveBeenLastCalledWith(nextDraft)
  })

  it('renders typed disabled external targets without transferring commit ownership', async () => {
    const target = { id: 'external-agent:codex', adapterId: 'codex', label: 'Codex External Agent', disabled: true }
    let commit: (() => Promise<boolean>) | null = null
    await act(async () => {
      create(<ContinueInDshAdapter {...base({
        targets: [target], selectedTarget: target.id,
        registerCommit: (next: (() => Promise<boolean>) | null) => { commit = next; return () => { commit = null } },
      }) as never} />)
    })
    expect(pickerProps).toMatchObject({ externalTargets: [target], externalSelection: target.id })
    expect(pickerProps).not.toHaveProperty('select')
    expect(commit).toBeTypeOf('function')
  })
})
