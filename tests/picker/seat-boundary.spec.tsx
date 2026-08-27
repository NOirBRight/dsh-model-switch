import React from 'react'
import { act, create } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { PickerSeatBoundary } from '../../src/client/picker/PickerSeatBoundary.tsx'

function Crash(): React.ReactNode { throw new Error('catalog exploded') }

describe('PickerSeatBoundary', () => {
  it('keeps a custom-seat diagnostic mounted instead of abdicating to the official picker', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    let view!: ReturnType<typeof create>
    await act(async () => {
      view = create(
        <PickerSeatBoundary errorLabel={message => `选择器失败：${message}；点击重试`}>
          <Crash />
        </PickerSeatBoundary>,
      )
    })
    const diagnostic = view.root.findByProps({ 'data-dsh-ms-seat-error': true })
    expect(diagnostic.children.join('')).toBe('选择器失败：catalog exploded；点击重试')
    expect(diagnostic.children.join('')).not.toContain('Model picker error')
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})
