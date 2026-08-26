import { createElement, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ModelPaneHeader } from '../../src/client/picker/ComposerPicker.tsx'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: ({ icon, children, ...props }: { icon?: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) =>
    createElement('button', props, icon, children),
  Input: ({ icon, ...props }: { icon?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) =>
    createElement('span', null, icon, createElement('input', props)),
  IconCheckOutline16: () => createElement('svg'),
  IconChevronDownOutline14: () => createElement('svg'),
  IconChevronLeftOutline14: () => createElement('svg'),
  IconChevronRightOutline14: () => createElement('svg'),
  IconCloseOutline16: () => createElement('svg'),
  IconSearchOutline16: () => createElement('svg'),
  IconWarningOutline16: () => createElement('svg'),
  Toast: () => null,
}))

const baseProps = {
  title: '模型',
  backLabel: '返回模型设置',
  searchLabel: '搜索模型',
  closeSearchLabel: '关闭搜索',
  searchable: true,
  query: '',
  onBack: vi.fn(),
  onStartSearch: vi.fn(),
  onCloseSearch: vi.fn(),
  onQueryChange: vi.fn(),
}

describe('ModelPaneHeader', () => {
  it('keeps model navigation separate from optional search', () => {
    const html = renderToStaticMarkup(<ModelPaneHeader {...baseProps} searching={false} />)

    expect(html).toContain('模型')
    expect(html).toContain('aria-label="搜索模型"')
    expect(html).not.toContain('<input')
  })

  it('replaces the title with a themed search input in the same header', () => {
    const html = renderToStaticMarkup(<ModelPaneHeader {...baseProps} searching />)

    expect(html).toContain('<input')
    expect(html).toContain('type="search"')
    expect(html).toContain('aria-label="搜索模型"')
    expect(html).toContain('aria-label="关闭搜索"')
  })
})
