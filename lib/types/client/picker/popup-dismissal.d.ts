/** Dismissal contract shared by the portaled picker and mobile Back routing. */
export interface PickerInteractionSource {
    kind: 'touch' | 'keyboard' | 'platform' | 'spatial' | 'programmatic';
    detail?: string;
}
export interface PickerInteractionOperations {
    registerSurface(surface: {
        readonly id: string;
        readonly kind: 'popup';
        dismiss(source: PickerInteractionSource): void;
    }): () => void;
}
export interface PickerDismissalOptions {
    documentTarget: Document;
    surfaceId: string;
    interaction?: PickerInteractionOperations;
    trigger: () => HTMLElement | null;
    popup: () => HTMLElement | null;
    dismiss: () => void;
}
/** Install capture-phase outside-pointer dismissal and optional mobile Back registration. */
export declare function installPickerDismissal({ documentTarget, surfaceId, interaction, trigger, popup, dismiss, }: PickerDismissalOptions): () => void;
