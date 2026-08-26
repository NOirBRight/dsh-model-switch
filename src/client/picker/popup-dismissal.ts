/** Dismissal contract shared by the portaled picker and mobile Back routing. */

export interface PickerInteractionSource {
  kind: 'touch' | 'keyboard' | 'platform' | 'spatial' | 'programmatic'
  detail?: string
}

export interface PickerInteractionOperations {
  registerSurface(surface: {
    readonly id: string
    readonly kind: 'popup'
    dismiss(source: PickerInteractionSource): void
  }): () => void
}

export interface PickerDismissalOptions {
  documentTarget: Document
  surfaceId: string
  interaction?: PickerInteractionOperations
  trigger: () => HTMLElement | null
  popup: () => HTMLElement | null
  dismiss: () => void
}

/** Install capture-phase outside-pointer dismissal and optional mobile Back registration. */
export function installPickerDismissal({
  documentTarget, surfaceId, interaction, trigger, popup, dismiss,
}: PickerDismissalOptions): () => void {
  const unregister = interaction?.registerSurface({
    id: surfaceId,
    kind: 'popup',
    dismiss: () => { dismiss() },
  }) ?? (() => {})
  const onPointerDown = (event: Event): void => {
    const target = event.target
    if (!(target instanceof Node)) return
    if (trigger()?.contains(target) || popup()?.contains(target)) return
    dismiss()
  }
  documentTarget.addEventListener('pointerdown', onPointerDown, true)
  return () => {
    documentTarget.removeEventListener('pointerdown', onPointerDown, true)
    unregister()
  }
}
