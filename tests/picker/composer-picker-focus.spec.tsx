// @vitest-environment happy-dom

import { act, createElement, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComposerPickerProps } from '../../src/client/picker/ComposerPicker.tsx'
import type { PickerKey } from '../../src/client/picker/locales.ts'
import type { PickerDirectorySnapshot } from '../../src/client/picker/PickerDirectory.ts'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => {
  const Icon = () => null
  return {
    Button: ({ icon: _icon, children, ...props }: { icon?: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) =>
      createElement('button', props, children),
    Input: ({ icon: _icon, ...props }: { icon?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) =>
      createElement('input', props),
    Toast: () => null,
    IconCheckOutlineRegular: Icon,
    IconChevronDownOutlineRegular: Icon,
    IconChevronLeftOutlineRegular: Icon,
    IconChevronRightOutlineRegular: Icon,
    IconCloseOutlineRegular: Icon,
    IconSearchOutlineRegular: Icon,
    IconWarningOutlineRegular: Icon,
  }
})

vi.mock('dsh-llm-providers-ui/provider-ui', () => ({ ProviderMark: () => null }))

import { ComposerPicker } from '../../src/client/picker/ComposerPicker.tsx'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const selection = { provider: 'codex', model: 'old-model' }
const snapshot: PickerDirectorySnapshot = {
  current: selection,
  routable: true,
  groups: [{ id: 'codex', name: 'Codex', models: [
    { id: 'old-model', name: 'Old Model' },
    { id: 'new-model', name: 'New Model' },
  ] }],
  failures: [],
  status: 'ready' as const,
  error: null,
}

let mounted: { container: HTMLDivElement, root: Root } | undefined

async function mountPicker(tone?: 'capsule'): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted = { container, root }
  const props: ComposerPickerProps = {
    locked: false,
    available: true,
    directory: {
      snapshot,
      getDirectorySnapshot: () => snapshot,
      load: vi.fn(),
      select: vi.fn(async () => true),
    },
    draft: selection,
    onDraftChange: vi.fn(),
    t: (key: PickerKey) => key,
    ...(tone === undefined ? {} : { tone }),
  }
  await act(async () => {
    root.render(<ComposerPicker {...props} />)
  })
  return container
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => { element.focus(); element.click() })
}

async function pressEscape(): Promise<void> {
  await act(async () => {
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  })
}

function menu(): HTMLDivElement {
  const element = document.body.querySelector<HTMLDivElement>('[role="menu"]')
  if (element === null) throw new Error('picker menu is not open')
  return element
}

function buttonByLabel(parent: ParentNode, label: string): HTMLButtonElement {
  const element = parent.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  if (element === null) throw new Error('button not found: ' + label)
  return element
}

function buttonWithText(parent: ParentNode, label: string): HTMLButtonElement {
  const element = [...parent.querySelectorAll<HTMLButtonElement>('button')]
    .find(button => button.textContent?.includes(label))
  if (element === undefined) throw new Error('button not found: ' + label)
  return element
}

afterEach(async () => {
  if (mounted !== undefined) await act(async () => { mounted?.root.unmount() })
  mounted?.container.remove()
  mounted = undefined
  document.body.replaceChildren()
})

describe('ComposerPicker focus', () => {
  it('keeps Escape working after selecting a model and returning to the summary', async () => {
    const container = await mountPicker()
    await click(container.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!)
    await click(buttonWithText(menu(), 'menu.model'))

    const newModel = [...menu().querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')]
      .find(button => button.textContent?.includes('New Model'))
    if (newModel === undefined) throw new Error('new model option not found')
    await click(newModel)

    expect(menu().textContent).toContain('menu.model')
    expect(document.activeElement).toBe(menu())

    await pressEscape()
    expect(document.body.querySelector('[role="menu"]')).toBeNull()
    expect(document.activeElement).toBe(container.querySelector('[aria-haspopup="menu"]'))
  })

  it('does not steal search focus in the embedded capsule picker and restores Escape after closing search', async () => {
    const container = await mountPicker('capsule')
    await click(container.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!)
    await click(buttonWithText(menu(), 'menu.model'))
    await click(buttonByLabel(menu(), 'menu.search'))

    const search = menu().querySelector<HTMLInputElement>('input[type="search"]')
    expect(search).not.toBeNull()
    expect(document.activeElement).toBe(search)

    await pressEscape()
    expect(menu().querySelector('input[type="search"]')).toBeNull()
    expect(document.activeElement).toBe(menu())

    await click(buttonByLabel(menu(), 'menu.back'))
    expect(menu().textContent).toContain('menu.model')
    expect(document.activeElement).toBe(menu())

    await pressEscape()
    expect(document.body.querySelector('[role="menu"]')).toBeNull()
  })
})
