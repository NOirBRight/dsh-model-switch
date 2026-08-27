import React from 'react'
import { act, create } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-dom', () => ({ createPortal: (node: React.ReactNode) => node }))
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => {
  const Icon = () => <span />
  return {
    Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
    Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
    Toast: () => null,
    IconCheckOutline16: Icon, IconChevronDownOutline14: Icon, IconChevronLeftOutline14: Icon,
    IconChevronRightOutline14: Icon, IconCloseOutline16: Icon, IconSearchOutline16: Icon, IconWarningOutline16: Icon,
  }
})
vi.mock('../../src/client/picker/popup-dismissal.ts', () => ({ installPickerDismissal: () => () => undefined }))

import { ComposerPicker } from '../../src/client/picker/ComposerPicker.tsx'

Object.assign(globalThis, {
  document: { body: {} },
  window: { innerWidth: 390, innerHeight: 844 },
})

const snapshot = { current: null, routable: null, groups: [], failures: [], status: 'ready', error: null }
const target = { id: 'external-agent:codex' as const, label: 'Codex', disabled: false }

function props(locked: boolean, onExternalTargetChange = vi.fn()) {
  return {
    locked, available: false,
    directory: { snapshot, getDirectorySnapshot: () => snapshot, load: vi.fn(), select: vi.fn(async () => true) },
    draft: { provider: 'codex', model: 'gpt' }, onDraftChange: vi.fn(),
    t: (key: string) => key, embedded: true, externalTargets: [target],
    externalSelection: undefined, onExternalTargetChange,
  }
}

describe('ComposerPicker Plan transaction lock', () => {
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
          : {},
      })
    })
    await act(async () => { picker.root.findByProps({ 'aria-haspopup': 'menu' }).props.onClick() })
    expect(String(picker.root.findByProps({ role: 'menu' }).props.style.right)).toContain('62px')
  })

  it('closes an already-open menu and rejects stale target actions when locked', async () => {
    const onExternalTargetChange = vi.fn()
    let picker!: ReturnType<typeof create>
    await act(async () => { picker = create(<ComposerPicker {...props(false, onExternalTargetChange) as never} />) })
    const trigger = picker.root.findByProps({ 'aria-haspopup': 'menu' })
    await act(async () => { trigger.props.onClick() })
    const option = picker.root.findByProps({ role: 'menuitemradio' })
    expect(option.props.disabled).toBe(false)
    const staleClick = option.props.onClick

    await act(async () => { picker.update(<ComposerPicker {...props(true, onExternalTargetChange) as never} />) })
    expect(picker.root.findAllByProps({ role: 'menuitemradio' })).toHaveLength(0)
    await act(async () => { staleClick() })
    expect(onExternalTargetChange).not.toHaveBeenCalled()
    expect(picker.root.findByProps({ 'aria-haspopup': 'menu' }).props.disabled).toBe(true)
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
