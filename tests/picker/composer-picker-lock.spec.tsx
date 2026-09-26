import React, { useState } from 'react'
import { act, create } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-dom', () => ({ createPortal: (node: React.ReactNode) => node }))
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => {
  const Icon = () => <span />
  return {
    Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
    Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
    Toast: () => null,
    IconCheckOutlineRegular: Icon, IconChevronDownOutlineRegular: Icon, IconChevronLeftOutlineRegular: Icon,
    IconChevronRightOutlineRegular: Icon, IconCloseOutlineRegular: Icon, IconSearchOutlineRegular: Icon, IconWarningOutlineRegular: Icon,
  }
})
vi.mock('../../src/client/picker/popup-dismissal.ts', () => ({ installPickerDismissal: () => () => undefined }))

import { ComposerPicker } from '../../src/client/picker/ComposerPicker.tsx'

Object.assign(globalThis, {
  document: { body: {} },
  window: { innerWidth: 390, innerHeight: 844 },
})

const snapshot = { current: null, routable: null, groups: [], failures: [], status: 'ready', error: null }
function props(locked: boolean) {
  return {
    locked, available: true,
    directory: { snapshot, getDirectorySnapshot: () => snapshot, load: vi.fn(), select: vi.fn(async () => true) },
    draft: { provider: 'codex', model: 'gpt' }, onDraftChange: vi.fn(),
    t: (key: string) => key, embedded: true,
  }
}

function CombinedVariantHarness({ selected }: { selected: (model: string) => void }) {
  const reasoning = { defaultEffort: 'high', efforts: [{ id: 'high', name: 'High' }] }
  const [draft, setDraft] = useState({ provider: 'codex', model: 'gpt-5.6-sol' })
  const combinedSnapshot = {
    current: draft,
    routable: true,
    groups: [{
      id: 'codex',
      name: 'Codex',
      models: [
        { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', reasoning },
        { id: 'gpt-5.6-sol-fast', name: 'GPT-5.6 Sol Fast', reasoning },
        { id: 'gpt-5.6-sol-1m', name: 'GPT-5.6 Sol 1M', reasoning },
        { id: 'gpt-5.6-sol-1m-fast', name: 'GPT-5.6 Sol 1M Fast', reasoning },
      ],
    }],
    failures: [],
    status: 'ready' as const,
    error: null,
  }
  return <ComposerPicker {...{
    locked: false,
    available: true,
    directory: {
      snapshot: combinedSnapshot,
      getDirectorySnapshot: () => combinedSnapshot,
      load: vi.fn(),
      select: vi.fn(async () => true),
    },
    draft,
    onDraftChange: (next: typeof draft) => { setDraft(next); selected(next.model) },
    t: (key: string) => key,
    tone: 'capsule' as const,
  }} />
}

describe('ComposerPicker Plan transaction lock', () => {
  it('selects 1M and Fast together through the real two-pane UI path', async () => {
    const selected = vi.fn()
    let picker!: ReturnType<typeof create>
    await act(async () => { picker = create(<CombinedVariantHarness selected={selected} />) })
    const clickMenuItem = async (label: string) => {
      const row = picker.root.findAllByProps({ role: 'menuitem' }).find(item =>
        item.findAllByType('span').some(span => span.children.includes(label)),
      )
      expect(row).toBeDefined()
      await act(async () => { row!.props.onClick() })
    }
    const clickRadio = async (label: string) => {
      const row = picker.root.findAllByProps({ role: 'menuitemradio' }).find(item =>
        item.findAllByType('span').some(span => span.children.includes(label)),
      )
      expect(row).toBeDefined()
      await act(async () => { row!.props.onClick() })
    }

    await act(async () => { picker.root.findByProps({ 'aria-haspopup': 'menu' }).props.onClick() })
    await clickMenuItem('menu.context')
    await clickRadio('1M')
    await clickMenuItem('menu.fast')
    await clickRadio('fast.on')

    expect(selected).toHaveBeenLastCalledWith('gpt-5.6-sol-1m-fast')
  })
  it('keeps a routable current model visible when its catalog row is absent', async () => {
    const current = { provider: 'legacy', model: 'retained-route' }
    const retained = { ...snapshot, current, routable: true }
    let picker!: ReturnType<typeof create>
    await act(async () => {
      picker = create(<ComposerPicker {...{
        locked: false,
        available: true,
        directory: {
          snapshot: retained,
          getDirectorySnapshot: () => retained,
          load: vi.fn(),
          select: vi.fn(async () => true),
        },
        t: (key: string, params?: Record<string, string>) => params?.model ?? key,
      } as never} />)
    })
    const trigger = picker.root.findByProps({ 'aria-haspopup': 'menu' })
    expect(trigger.props.title).toBe('retained-route')
    expect(trigger.props['aria-label']).toBe('retained-route')
  })

  it('shows a Host-accepted selection while the directory projection catches up', async () => {
    const oldSelection = { provider: 'codex', model: 'old-model' }
    const delayedSnapshot = {
      current: oldSelection,
      routable: true,
      groups: [{
        id: 'codex',
        name: 'Codex',
        models: [
          { id: 'old-model', name: 'Old Model' },
          { id: 'new-model', name: 'New Model' },
        ],
      }],
      failures: [],
      status: 'ready' as const,
      error: null,
    }
    const select = vi.fn(async () => true)
    const pickerProps = {
      locked: false,
      available: true,
      directory: {
        snapshot: delayedSnapshot,
        getDirectorySnapshot: () => delayedSnapshot,
        load: vi.fn(),
        select,
      },
      t: (key: string, params?: Record<string, string>) => params?.model ?? key,
      tone: 'capsule' as const,
    }
    let picker!: ReturnType<typeof create>
    await act(async () => { picker = create(<ComposerPicker {...pickerProps as never} />) })
    await act(async () => { picker.root.findByProps({ 'aria-haspopup': 'menu' }).props.onClick() })
    const modelPane = picker.root.findAllByProps({ role: 'menuitem' }).find(item =>
      item.findAllByType('span').some(span => span.children.includes('menu.model')),
    )
    await act(async () => { modelPane!.props.onClick() })
    const newModel = picker.root.findAllByProps({ role: 'menuitemradio' }).find(item =>
      item.findAllByType('span').some(span => span.children.includes('New Model')),
    )
    await act(async () => { newModel!.props.onClick() })

    expect(select).toHaveBeenCalledWith({ provider: 'codex', model: 'new-model' })
    expect(picker.root.findByProps({ 'aria-haspopup': 'menu' }).props.title).toBe('New Model')

    const projectedSnapshot = { ...delayedSnapshot, current: { provider: 'codex', model: 'new-model' } }
    await act(async () => {
      picker.update(<ComposerPicker {...{
        ...pickerProps,
        directory: {
          ...pickerProps.directory,
          snapshot: projectedSnapshot,
          getDirectorySnapshot: () => projectedSnapshot,
        },
      } as never} />)
    })
    await act(async () => {
      picker.update(<ComposerPicker {...pickerProps as never} />)
    })
    expect(picker.root.findByProps({ 'aria-haspopup': 'menu' }).props.title).toBe('Old Model')
  })

  it('drops a Host-accepted overlay when the picker locks', async () => {
    const oldSelection = { provider: 'codex', model: 'old-model' }
    const delayedSnapshot = {
      current: oldSelection,
      routable: true,
      groups: [{ id: 'codex', name: 'Codex', models: [
        { id: 'old-model', name: 'Old Model' },
        { id: 'new-model', name: 'New Model' },
      ] }],
      failures: [],
      status: 'ready' as const,
      error: null,
    }
    const pickerProps = {
      locked: false,
      available: true,
      directory: {
        snapshot: delayedSnapshot,
        getDirectorySnapshot: () => delayedSnapshot,
        load: vi.fn(),
        select: vi.fn(async () => true),
      },
      t: (key: string, params?: Record<string, string>) => params?.model ?? key,
      tone: 'capsule' as const,
    }
    let picker!: ReturnType<typeof create>
    await act(async () => { picker = create(<ComposerPicker {...pickerProps as never} />) })
    await act(async () => { picker.root.findByProps({ 'aria-haspopup': 'menu' }).props.onClick() })
    const modelPane = picker.root.findAllByProps({ role: 'menuitem' }).find(item =>
      item.findAllByType('span').some(span => span.children.includes('menu.model')),
    )
    await act(async () => { modelPane!.props.onClick() })
    const newModel = picker.root.findAllByProps({ role: 'menuitemradio' }).find(item =>
      item.findAllByType('span').some(span => span.children.includes('New Model')),
    )
    await act(async () => { newModel!.props.onClick() })
    expect(picker.root.findByProps({ 'aria-haspopup': 'menu' }).props.title).toBe('New Model')
    await act(async () => {
      picker.update(<ComposerPicker {...{ ...pickerProps, locked: true } as never} />)
    })
    expect(picker.root.findByProps({ 'aria-haspopup': 'menu' }).props.title).toBe('Old Model')
  })

  it('opens exactly once from a mobile pointerdown plus click activation', async () => {
    let picker!: ReturnType<typeof create>
    await act(async () => { picker = create(<ComposerPicker {...props(false) as never} />) })
    const trigger = picker.root.findByProps({ 'aria-haspopup': 'menu' })
    const pointerEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() }
    await act(async () => { trigger.props.onPointerDown(pointerEvent) })
    expect(picker.root.findAllByProps({ role: 'menu' })).toHaveLength(0)
    await act(async () => { trigger.props.onClick({ stopPropagation: vi.fn() }) })
    expect(picker.root.findAllByProps({ role: 'menu' })).toHaveLength(1)
  })

  it('disables other provider rows while keeping Antigravity rows selectable', async () => {
    const current = { provider: 'antigravity', model: 'gemini' }
    const lockedSnapshot = {
      current, routable: true, failures: [], status: 'ready' as const, error: null,
      groups: [
        { id: 'antigravity', name: 'Antigravity', models: [{ id: 'gemini', name: 'Gemini' }] },
        { id: 'codex', name: 'Codex', models: [{ id: 'gpt', name: 'GPT' }] },
      ],
    }
    const onDraftChange = vi.fn()
    let picker!: ReturnType<typeof create>
    await act(async () => {
      picker = create(<ComposerPicker {...{
        locked: false,
        providerLock: 'antigravity',
        available: true,
        directory: { snapshot: lockedSnapshot, getDirectorySnapshot: () => lockedSnapshot, load: vi.fn(), select: vi.fn() },
        draft: current,
        onDraftChange,
        t: (key: string) => key,
        embedded: true,
      } as never} />)
    })
    await act(async () => { picker.root.findByProps({ 'aria-haspopup': 'menu' }).props.onClick() })
    const rows = picker.root.findAllByProps({ role: 'menuitemradio' })
    const row = (label: string) => rows.find(item => item.findAllByType('span').some(span => span.children.includes(label)))!

    expect(row('Gemini').props.disabled).toBe(false)
    expect(row('GPT').props.disabled).toBe(true)
    await act(async () => { row('GPT').props.onClick() })
    expect(onDraftChange).not.toHaveBeenCalled()
  })

  it('greys out Agent-role rows on existing DSH sessions and refuses their selection', async () => {
    const current = { provider: 'codex', model: 'gpt' }
    const snapshot = {
      current, routable: true, failures: [], status: 'ready' as const, error: null,
      groups: [
        { id: 'antigravity', name: 'Antigravity', models: [{ id: 'gemini', name: 'Gemini' }] },
        { id: 'codex', name: 'Codex', models: [{ id: 'gpt', name: 'GPT' }] },
      ],
    }
    const onDraftChange = vi.fn()
    const roleOf = (key: string) => key === 'antigravity' ? 'agent' : 'llm'
    let picker!: ReturnType<typeof create>
    await act(async () => {
      picker = create(<ComposerPicker {...{
        locked: false,
        agentLocked: true,
        available: true,
        roleOf,
        directory: { snapshot, getDirectorySnapshot: () => snapshot, load: vi.fn(), select: vi.fn() },
        draft: current,
        onDraftChange,
        t: (key: string) => key,
        embedded: true,
      } as never} />)
    })
    await act(async () => { picker.root.findByProps({ 'aria-haspopup': 'menu' }).props.onClick() })
    const rows = picker.root.findAllByProps({ role: 'menuitemradio' })
    const row = (label: string) => rows.find(item => item.findAllByType('span').some(span => span.children.includes(label)))!
    expect(row('GPT').props.disabled).toBe(false)
    expect(row('Gemini').props.disabled).toBe(true)
    await act(async () => { row('Gemini').props.onClick() })
    expect(onDraftChange).not.toHaveBeenCalled()
  })

  it('ignores a detail-zero mobile fallback reopen after one close gesture', async () => {
    let picker!: ReturnType<typeof create>
    await act(async () => { picker = create(<ComposerPicker {...props(false) as never} />) })
    const event = () => ({ detail: 1, stopPropagation: vi.fn() })
    let trigger = picker.root.findByProps({ 'aria-haspopup': 'menu' })
    await act(async () => { trigger.props.onPointerDown(event()); trigger.props.onClick(event()) })
    expect(picker.root.findAllByProps({ role: 'menu' })).toHaveLength(1)

    trigger = picker.root.findByProps({ 'aria-haspopup': 'menu' })
    await act(async () => { trigger.props.onPointerDown(event()); trigger.props.onClick(event()) })
    trigger = picker.root.findByProps({ 'aria-haspopup': 'menu' })
    await act(async () => { trigger.props.onClick({ detail: 0, stopPropagation: vi.fn() }) })
    expect(picker.root.findAllByProps({ role: 'menu' })).toHaveLength(0)
  })

  it('positions its portaled menu inside mobile right and bottom safe areas', async () => {
    let picker!: ReturnType<typeof create>
    await act(async () => {
      picker = create(<ComposerPicker {...props(false) as never} />, {
        createNodeMock: element => element.props['aria-haspopup'] === 'menu'
          ? { getBoundingClientRect: () => ({ top: 700, right: 370 }) }
          : element.props.role === 'menu'
            ? { contains: () => false, focus: vi.fn() }
            : {},
      })
    })
    await act(async () => { picker.root.findByProps({ 'aria-haspopup': 'menu' }).props.onClick() })
    const style = picker.root.findByProps({ role: 'menu' }).props.style
    expect(String(style.right)).toContain('safe-area-inset-right')
    expect(String(style.bottom)).toContain('safe-area-inset-bottom')
    expect(String(style.maxWidth)).toContain('safe-area-inset-left')
    expect(String(style.maxWidth)).toContain('safe-area-inset-right')
  })

  it('shifts away from its trigger to preserve the 320px preferred mobile width', async () => {
    let picker!: ReturnType<typeof create>
    await act(async () => {
      picker = create(<ComposerPicker {...props(false) as never} />, {
        createNodeMock: element => element.props['aria-haspopup'] === 'menu'
          ? { getBoundingClientRect: () => ({ top: 700, right: 250 }) }
          : element.props.role === 'menu'
            ? { contains: () => false, focus: vi.fn() }
            : {},
      })
    })
    await act(async () => { picker.root.findByProps({ 'aria-haspopup': 'menu' }).props.onClick() })
    expect(String(picker.root.findByProps({ role: 'menu' }).props.style.right)).toContain('62px')
  })

  it('opens the Model/Effort root pane on a capsule trigger', async () => {
    let picker!: ReturnType<typeof create>
    await act(async () => {
      picker = create(<ComposerPicker {...{ ...props(false), tone: 'capsule' } as never} />)
    })
    await act(async () => { picker.root.findByProps({ 'aria-haspopup': 'menu' }).props.onClick() })
    const labels = picker.root.findAllByType('span').flatMap(node => node.children)
    expect(labels).toContain('menu.model')
    expect(labels).not.toContain('menu.search')
  })
})

function liveVariantPicker(options: {
  provider: string
  model: string
  models: Array<{ id: string, name: string }>
  agentLocked?: boolean
  role?: string
}) {
  const current = { provider: options.provider, model: options.model }
  const snapshot = {
    current,
    routable: true,
    failures: [] as const,
    status: 'ready' as const,
    error: null,
    groups: [{ id: options.provider, name: options.provider, models: options.models }],
  }
  const select = vi.fn(async () => true)
  return {
    select,
    props: {
      locked: false,
      agentLocked: options.agentLocked ?? false,
      available: true,
      directory: { snapshot, getDirectorySnapshot: () => snapshot, load: vi.fn(), select },
      t: (key: string) => key,
      tone: 'capsule' as const,
      ...(options.role === undefined ? {} : { roleOf: (key: string) => key === options.provider ? options.role : 'llm' }),
    },
  }
}

async function openRadio(picker: ReturnType<typeof create>, menu: string, label: string) {
  await act(async () => { picker.root.findByProps({ 'aria-haspopup': 'menu' }).props.onClick() })
  const item = picker.root.findAllByProps({ role: 'menuitem' }).find(row =>
    row.findAllByType('span').some(span => span.children.includes(menu)),
  )
  expect(item).toBeDefined()
  await act(async () => { item!.props.onClick() })
  const radio = picker.root.findAllByProps({ role: 'menuitemradio' }).find(row =>
    row.findAllByType('span').some(span => span.children.includes(label)),
  )
  expect(radio).toBeDefined()
  return radio!
}

describe('ComposerPicker Fast/Context after a turn', () => {
  const cursorModels = [
    { id: 'composer-2.5', name: 'Composer 2.5' },
    { id: 'composer-2.5-fast', name: 'Composer 2.5 Fast' },
    { id: 'composer-2.5-1m', name: 'Composer 2.5 Max' },
    { id: 'composer-2.5-fast-1m', name: 'Composer 2.5 Fast Max' },
    { id: 'grok-4.6', name: 'Cursor Grok 4.6' },
  ]

  it('keeps Fast on the current Agent after a turn', async () => {
    const { select, props } = liveVariantPicker({
      provider: 'cursor-agent',
      model: 'composer-2.5-fast',
      models: cursorModels,
      agentLocked: true,
      role: 'agent',
    })
    let picker!: ReturnType<typeof create>
    await act(async () => { picker = create(<ComposerPicker {...props as never} />) })
    const off = await openRadio(picker, 'menu.fast', 'fast.off')
    expect(off.props.disabled).toBe(false)
    await act(async () => { off.props.onClick() })
    expect(select).toHaveBeenCalledWith({ provider: 'cursor-agent', model: 'composer-2.5' })
  })

  it('keeps Context on the current Agent after a turn', async () => {
    const { select, props } = liveVariantPicker({
      provider: 'cursor-agent',
      model: 'composer-2.5',
      models: cursorModels,
      agentLocked: true,
      role: 'agent',
    })
    let picker!: ReturnType<typeof create>
    await act(async () => { picker = create(<ComposerPicker {...props as never} />) })
    const max = await openRadio(picker, 'menu.context', '1M')
    expect(max.props.disabled).toBe(false)
    await act(async () => { max.props.onClick() })
    expect(select).toHaveBeenCalledWith({ provider: 'cursor-agent', model: 'composer-2.5-1m' })
  })

  it('still switches Fast on a current LLM while Agent conversion is locked', async () => {
    const { select, props } = liveVariantPicker({
      provider: 'codex',
      model: 'gpt-5.6-sol-fast',
      models: [
        { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol' },
        { id: 'gpt-5.6-sol-fast', name: 'GPT-5.6 Sol Fast' },
      ],
      agentLocked: true,
    })
    let picker!: ReturnType<typeof create>
    await act(async () => { picker = create(<ComposerPicker {...props as never} />) })
    const off = await openRadio(picker, 'menu.fast', 'fast.off')
    expect(off.props.disabled).toBe(false)
    await act(async () => { off.props.onClick() })
    expect(select).toHaveBeenCalledWith({ provider: 'codex', model: 'gpt-5.6-sol' })
  })

  it('disables Fast Off when the non-Fast sibling is missing at the current Context tier', async () => {
    const { select, props } = liveVariantPicker({
      provider: 'codex',
      model: 'gpt-5.6-sol-1m-fast',
      models: [
        { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol' },
        { id: 'gpt-5.6-sol-fast', name: 'GPT-5.6 Sol Fast' },
        { id: 'gpt-5.6-sol-1m-fast', name: 'GPT-5.6 Sol 1M Fast' },
      ],
    })
    let picker!: ReturnType<typeof create>
    await act(async () => { picker = create(<ComposerPicker {...props as never} />) })
    const off = await openRadio(picker, 'menu.fast', 'fast.off')
    expect(off.props.disabled).toBe(true)
    expect(off.props.title).toBe('choice.unavailable')
    await act(async () => { off.props.onClick() })
    expect(select).not.toHaveBeenCalled()
  })

  it('disables a Context tier that pickVariant cannot honor at the current Fast axis', async () => {
    const { select, props } = liveVariantPicker({
      provider: 'codex',
      model: 'gpt-5.6-sol',
      models: [
        { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol' },
        { id: 'gpt-5.6-sol-fast', name: 'GPT-5.6 Sol Fast' },
        { id: 'gpt-5.6-sol-1m-fast', name: 'GPT-5.6 Sol 1M Fast' },
      ],
    })
    let picker!: ReturnType<typeof create>
    await act(async () => { picker = create(<ComposerPicker {...props as never} />) })
    const max = await openRadio(picker, 'menu.context', '1M')
    expect(max.props.disabled).toBe(true)
    expect(max.props.title).toBe('choice.unavailable')
    await act(async () => { max.props.onClick() })
    expect(select).not.toHaveBeenCalled()
  })
})
