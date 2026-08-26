/** Continue-in-DSH draft editor contributed into external-agents' Plan router slot. */
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { type ExternalAgentAdapterId, type ExternalPlanTargetId, type PickerDirectoryFace, type PlanTargetId } from './ComposerPicker.tsx';
import type { PickerInteractionOperations } from './popup-dismissal.ts';
/** Mirrored public slot id; there is deliberately no runtime plugin dependency. */
export declare const CONTINUE_IN_DSH_SLOT: "external-agents.plan-review.continue-in-dsh";
export interface PlanExternalAgentTarget {
    id: ExternalPlanTargetId;
    adapterId: ExternalAgentAdapterId;
    label: string;
    description?: string;
    disabled?: boolean;
}
/** Public plugin-to-plugin owner Interface; Composer supplies the execution commit. */
export interface ContinueInDshOwner {
    locked: boolean;
    targets: readonly PlanExternalAgentTarget[];
    targetsLabel: string;
    selectedTarget: PlanTargetId;
    selectTarget: (target: PlanTargetId) => void;
    registerCommit: (commit: (() => Promise<boolean>) | null) => () => void;
}
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface SlotMap {
        'external-agents.plan-review.continue-in-dsh': {
            kind: 'single';
            scope: 'session';
            owner: ContinueInDshOwner;
        };
    }
}
export interface ContinueInDshFace extends PickerDirectoryFace {
    available: boolean;
    resolveInteractionOperations?: () => PickerInteractionOperations | undefined;
}
type Props = PropsRuntime<typeof CONTINUE_IN_DSH_SLOT> & PropsLocale<'composer-picker'> & ContinueInDshOwner & InjectFace<ContinueInDshFace>;
export declare function ContinueInDshAdapter(props: Props): import("react").JSX.Element;
export {};
