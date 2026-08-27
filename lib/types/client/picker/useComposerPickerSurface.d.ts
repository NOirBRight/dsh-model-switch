import { type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { type PickerInteractionOperations } from './popup-dismissal.ts';
export interface ComposerPickerSurfaceOptions {
    locked: boolean;
    embedded: boolean;
    tone?: 'capsule';
    pane: string;
    reload: () => void;
    onOpen: () => void;
    onClose: () => void;
    resolveInteractionOperations?: () => PickerInteractionOperations | undefined;
}
export interface ComposerPickerSurface {
    id: string;
    open: boolean;
    menuStyle: CSSProperties;
    triggerRef: RefObject<HTMLButtonElement>;
    menuRef: RefObject<HTMLDivElement>;
    show: () => void;
    close: (restoreFocus?: boolean) => void;
    onTriggerPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
    onTriggerClick: (event?: ReactMouseEvent<HTMLButtonElement>) => void;
}
/** Own popup activation, positioning, and dismissal behind one internal seam. */
export declare function useComposerPickerSurface(options: ComposerPickerSurfaceOptions): ComposerPickerSurface;
