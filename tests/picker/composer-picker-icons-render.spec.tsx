import { createElement, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ComposerPicker } from '../../src/client/picker/ComposerPicker.tsx'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: ({ icon, children, ...props }: { icon?: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) =>
    createElement('button', props, icon, children),
  Input: (props: object) => createElement('input', props),
  IconCheckOutlineRegular: () => createElement('svg'),
  IconChevronDownOutlineRegular: () => createElement('svg'),
  IconChevronLeftOutlineRegular: () => createElement('svg'),
  IconChevronRightOutlineRegular: () => createElement('svg'),
  IconCloseOutlineRegular: () => createElement('svg'),
  IconSearchOutlineRegular: () => createElement('svg'),
  IconWarningOutlineRegular: () => createElement('svg'),
  Toast: () => null,
}))
vi.mock('../../src/client/picker/popup-dismissal.ts', () => ({ installPickerDismissal: () => () => undefined }))
vi.mock('../../src/client/picker/useComposerPickerSurface.ts', () => ({
  useComposerPickerSurface: () => ({
    id: 'test', open: false, menuStyle: {}, triggerRef: { current: null }, menuRef: { current: null },
    close: vi.fn(), onTriggerPointerDown: vi.fn(), onTriggerClick: vi.fn(),
  }),
}))

const WHALE_VIEWBOX = 'viewBox="0 0 23.16 17.04"'

function triggerHtml(provider: string, providerName: string, roleOf?: (key: string) => string | undefined): string {
  const snapshot = {
    current: { provider, model: 'm' }, routable: true,
    groups: [{ id: provider, name: providerName, models: [{ id: 'm', name: 'M' }] }],
    failures: [], status: 'ready' as const, error: null,
  }
  return renderToStaticMarkup(createElement(ComposerPicker, {
    locked: false, available: true,
    directory: { snapshot, getDirectorySnapshot: () => snapshot, load: vi.fn(), select: vi.fn(async () => true) },
    draft: { provider, model: 'm' }, onDraftChange: vi.fn(),
    t: (key: string) => key, embedded: true,
    ...(roleOf === undefined ? {} : { roleOf }),
  } as never))
}

// Runtime icon, not provider icon: DSH-owned LLM families share the whale.
const llmRoleOf = (): string | undefined => 'llm'
const agentRoleOf = (key: string): string | undefined => key === 'antigravity' ? 'agent' : 'llm'

describe('picker trigger runtime icons', () => {
  it.each([
    ['deepseek-official', 'DeepSeek'],
    ['codex', 'Codex'],
    ['grok', 'Grok'],
  ])('shows the DSH whale for the DSH-owned LLM family %s', (provider, name) => {
    const html = triggerHtml(provider, name, llmRoleOf)
    expect(html).toContain(WHALE_VIEWBOX)
    expect(html).not.toContain('viewBox="0 0 562 545"')
  })

  it('shows the own mark for the native Agent family', () => {
    const html = triggerHtml('antigravity', 'Antigravity', agentRoleOf)
    expect(html).toContain('viewBox="13.4 8.4 142.1 129.9"')
    expect(html).not.toContain(WHALE_VIEWBOX)
  })

  it('defaults to the whale when no role resolver is provided', () => {
    const html = triggerHtml('codex', 'Codex')
    expect(html).toContain(WHALE_VIEWBOX)
  })
})
