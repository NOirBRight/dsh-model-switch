import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installPickerDismissal, type PickerInteractionOperations } from '../../src/client/picker/popup-dismissal.ts'

const originalNode = globalThis.Node

class FakeNode extends EventTarget {}

class FakeElement extends FakeNode {
  readonly children = new Set<FakeNode>()

  contains(target: Node): boolean {
    return target === this || this.children.has(target as unknown as FakeNode)
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'Node', { configurable: true, value: FakeNode })
})

afterEach(() => {
  if (originalNode === undefined) delete (globalThis as { Node?: typeof Node }).Node
  else Object.defineProperty(globalThis, 'Node', { configurable: true, value: originalNode })
})

describe('installPickerDismissal', () => {
  it('registers a popup surface and capture pointerdown dismissal', () => {
    let pointerListener: EventListener | undefined
    const documentTarget = {
      addEventListener: vi.fn((type: string, listener: EventListener, capture?: boolean) => {
        expect(type).toBe('pointerdown')
        expect(capture).toBe(true)
        pointerListener = listener
      }),
      removeEventListener: vi.fn(),
    }
    const unregister = vi.fn()
    let surface: Parameters<PickerInteractionOperations['registerSurface']>[0] | undefined
    const interaction: PickerInteractionOperations = {
      registerSurface: vi.fn(registration => {
        surface = registration
        return unregister
      }),
    }
    const trigger = new FakeElement()
    const popup = new FakeElement()
    const triggerChild = new FakeNode()
    const popupChild = new FakeNode()
    const outside = new FakeNode()
    trigger.children.add(triggerChild)
    popup.children.add(popupChild)
    const dismiss = vi.fn()

    const dispose = installPickerDismissal({
      documentTarget: documentTarget as unknown as Document,
      surfaceId: 'composer-model-picker-test',
      interaction,
      trigger: () => trigger as unknown as HTMLElement,
      popup: () => popup as unknown as HTMLElement,
      dismiss,
    })

    expect(surface).toMatchObject({ id: 'composer-model-picker-test', kind: 'popup' })
    pointerListener?.({ target: triggerChild } as unknown as Event)
    pointerListener?.({ target: popupChild } as unknown as Event)
    expect(dismiss).not.toHaveBeenCalled()

    pointerListener?.({ target: outside } as unknown as Event)
    expect(dismiss).toHaveBeenCalledTimes(1)
    surface?.dismiss({ kind: 'touch' })
    expect(dismiss).toHaveBeenCalledTimes(2)

    dispose()
    expect(documentTarget.removeEventListener).toHaveBeenCalledWith('pointerdown', pointerListener, true)
    expect(unregister).toHaveBeenCalledOnce()
  })

  it('keeps outside-pointer dismissal when an optional mobile surface rejects registration', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const documentTarget = { addEventListener: vi.fn(), removeEventListener: vi.fn() }
    const interaction: PickerInteractionOperations = {
      registerSurface: vi.fn(() => { throw new Error('surface unavailable') }),
    }

    expect(() => installPickerDismissal({
      documentTarget: documentTarget as unknown as Document,
      surfaceId: 'composer-model-picker-fallback',
      interaction,
      trigger: () => null,
      popup: () => null,
      dismiss: vi.fn(),
    })).not.toThrow()
    expect(documentTarget.addEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function), true)
    expect(warn).toHaveBeenCalledWith('dsh-model-switch: optional interaction surface registration failed', expect.any(Error))
    warn.mockRestore()
  })
})
