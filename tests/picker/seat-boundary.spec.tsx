import React from 'react'
import { act, create } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { PickerSeatBoundary } from '../../src/client/picker/PickerSeatBoundary.tsx'

function Crash(): React.ReactNode { throw new Error('catalog exploded') }

describe('PickerSeatBoundary', () => {
  it('keeps a custom-seat diagnostic mounted instead of abdicating to the official picker', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    let view!: ReturnType<typeof create>
    await act(async () => { view = create(<PickerSeatBoundary><Crash /></PickerSeatBoundary>) })
    expect(view.root.findByProps({ 'data-dsh-ms-seat-error': true }).children.join('')).toContain('catalog exploded')
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})
