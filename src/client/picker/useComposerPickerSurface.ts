import {
  useCallback, useEffect, useId, useLayoutEffect, useRef, useState,
  type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type RefObject,
} from 'react'
import { installPickerDismissal, type PickerInteractionOperations } from './popup-dismissal.ts'

export interface ComposerPickerSurfaceOptions {
  locked: boolean
  embedded: boolean
  tone?: 'capsule'
  pane: string
  reload: () => void
  onOpen: () => void
  onClose: () => void
  resolveInteractionOperations?: () => PickerInteractionOperations | undefined
}

export interface ComposerPickerSurface {
  id: string
  open: boolean
  menuStyle: CSSProperties
  triggerRef: RefObject<HTMLButtonElement>
  menuRef: RefObject<HTMLDivElement>
  show: () => void
  close: (restoreFocus?: boolean) => void
  onTriggerPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onTriggerClick: (event?: ReactMouseEvent<HTMLButtonElement>) => void
}

/** Own popup activation, positioning, and dismissal behind one internal seam. */
export function useComposerPickerSurface(options: ComposerPickerSurfaceOptions): ComposerPickerSurface {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ position: 'fixed', zIndex: 4000 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const pointerOpenIntent = useRef<{ open: boolean, until: number } | null>(null)
  const callbacks = useRef({ onOpen: options.onOpen, onClose: options.onClose })
  callbacks.current = { onOpen: options.onOpen, onClose: options.onClose }
  const lockedRef = useRef(options.locked)
  lockedRef.current = options.locked
  const id = useId()

  const close = useCallback((restoreFocus = false): void => {
    setOpen(false)
    callbacks.current.onClose()
    if (restoreFocus) queueMicrotask(() => { triggerRef.current?.focus() })
  }, [])

  const show = (): void => {
    if (lockedRef.current) return
    callbacks.current.onOpen()
    setOpen(true)
    if (options.tone !== 'capsule') options.reload()
  }

  useEffect(() => {
    if (options.locked) close()
  }, [close, options.locked])

  useLayoutEffect(() => {
    if (!open) return
    const trigger = triggerRef.current
    if (trigger === null) return
    const rect = trigger.getBoundingClientRect()
    const gutter = 8
    const maxWidth = Math.min(420, window.innerWidth - gutter * 2)
    const preferredWidth = Math.min(320, maxWidth)
    const right = Math.min(
      Math.max(gutter, window.innerWidth - rect.right),
      Math.max(gutter, window.innerWidth - gutter - preferredWidth),
    )
    const safeRight = 'max(' + right + 'px, calc(env(safe-area-inset-right) + ' + gutter + 'px))'
    setMenuStyle({
      position: 'fixed',
      right: safeRight,
      bottom: 'max(' + Math.max(gutter, window.innerHeight - rect.top + gutter) + 'px, calc(env(safe-area-inset-bottom) + ' + gutter + 'px))',
      maxWidth: 'max(0px, calc(100vw - ' + safeRight + ' - env(safe-area-inset-left) - ' + gutter + 'px))',
      zIndex: 4000,
    })
  }, [open, options.embedded, options.pane])

  useEffect(() => {
    if (!open || options.tone === 'capsule') return
    const interaction = options.resolveInteractionOperations?.()
    return installPickerDismissal({
      documentTarget: document,
      surfaceId: 'composer-model-picker-' + id,
      ...(interaction === undefined ? {} : { interaction }),
      trigger: () => triggerRef.current,
      popup: () => menuRef.current,
      dismiss: close,
    })
  }, [close, id, open, options.resolveInteractionOperations, options.tone])

  return {
    id,
    open,
    menuStyle,
    triggerRef,
    menuRef,
    show,
    close,
    onTriggerPointerDown: (event) => {
      event.stopPropagation()
      pointerOpenIntent.current = { open: !open, until: Date.now() + 750 }
    },
    onTriggerClick: (event) => {
      event?.stopPropagation()
      const intent = pointerOpenIntent.current
      const desiredOpen = intent !== null && Date.now() <= intent.until ? intent.open : !open
      if (intent !== null && Date.now() > intent.until) pointerOpenIntent.current = null
      if (desiredOpen) show(); else close()
    },
  }
}
