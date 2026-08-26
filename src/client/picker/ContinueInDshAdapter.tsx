/** Continue-in-DSH draft editor contributed into external-agents' Plan router slot. */

import { useLayoutEffect, useState } from 'react'
import type { ModelSelection } from '@deepseek-ai/dsh-api-remotes/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  ComposerPicker,
  type ExternalAgentAdapterId,
  type ExternalPlanTargetId,
  type PickerDirectoryFace,
  type PlanTargetId,
} from './ComposerPicker.tsx'
import type { PickerInteractionOperations } from './popup-dismissal.ts'

/** Mirrored public slot id; there is deliberately no runtime plugin dependency. */
export const CONTINUE_IN_DSH_SLOT = 'external-agents.plan-review.continue-in-dsh' as const

export interface PlanExternalAgentTarget {
  id: ExternalPlanTargetId
  adapterId: ExternalAgentAdapterId
  label: string
  description?: string
  disabled?: boolean
}

/** Public plugin-to-plugin owner Interface; Composer supplies the execution commit. */
export interface ContinueInDshOwner {
  locked: boolean
  targets: readonly PlanExternalAgentTarget[]
  targetsLabel: string
  selectedTarget: PlanTargetId
  selectTarget: (target: PlanTargetId) => void
  registerCommit: (commit: (() => Promise<boolean>) | null) => () => void
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'external-agents.plan-review.continue-in-dsh': {
      kind: 'single'
      scope: 'session'
      owner: ContinueInDshOwner
    }
  }
}

export interface ContinueInDshFace extends PickerDirectoryFace {
  available: boolean
  resolveInteractionOperations?: () => PickerInteractionOperations | undefined
}

type Props = PropsRuntime<typeof CONTINUE_IN_DSH_SLOT>
  & PropsLocale<'composer-picker'>
  & ContinueInDshOwner
  & InjectFace<ContinueInDshFace>

export function ContinueInDshAdapter(props: Props) {
  const directory = props.useDirectory(snapshot => snapshot)
  const [draft, setDraft] = useState<ModelSelection | undefined>()

  useLayoutEffect(() => props.registerCommit(async () => {
    if (!props.available) return false
    const selection = draft ?? props.getDirectorySnapshot().current ?? undefined
    return selection === undefined ? false : props.select(selection)
  }), [draft, props.available, props.getDirectorySnapshot, props.registerCommit, props.select])

  return <ComposerPicker
    locked={props.locked}
    available={props.available}
    directory={directory}
    getDirectorySnapshot={props.getDirectorySnapshot}
    load={props.load}
    t={props.t}
    {...props.resolveInteractionOperations === undefined
      ? {}
      : { resolveInteractionOperations: props.resolveInteractionOperations }}
    {...draft === undefined ? {} : { draft }}
    onDraftChange={selection => { setDraft(selection); props.selectTarget('dsh') }}
    externalTargets={props.targets}
    externalTargetsLabel={props.targetsLabel}
    {...props.selectedTarget === 'dsh' ? {} : { externalSelection: props.selectedTarget }}
    onExternalTargetChange={target => { props.selectTarget(target ?? 'dsh') }}
    embedded
  />
}
