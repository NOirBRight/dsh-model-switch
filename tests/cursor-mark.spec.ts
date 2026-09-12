import { expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProviderMark } from 'dsh-llm-providers-ui/provider-ui'

it('uses the Cursor mark for the native ACP provider in every picker', () => {
  expect(renderToStaticMarkup(createElement(ProviderMark, {providerKey:'cursor-agent'}))).toBe(renderToStaticMarkup(createElement(ProviderMark, {providerKey:'cursor'})))
})
