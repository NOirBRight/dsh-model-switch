/** Durable provider lock projected from Antigravity session startup. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {
  ConversationNodeDefinition,
  ConversationViewDefinition,
  ConversationViewNode,
} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { ANTIGRAVITY_PROVIDER_KEY } from './antigravity-catalog.ts'

export const ANTIGRAVITY_SESSION_READY = 'antigravity/session-ready'
export const RUNTIME_LOCK_TARGET = 'model-switch.runtime-lock'
export type RuntimeProviderLock = typeof ANTIGRAVITY_PROVIDER_KEY | null

interface RuntimeLockNode extends ConversationViewNode {
  readonly target: typeof RUNTIME_LOCK_TARGET
  readonly data: typeof ANTIGRAVITY_PROVIDER_KEY
}

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  interface ConversationViewSnapshotMap {
    'model-switch.runtime-lock': RuntimeProviderLock
  }
}

function isSessionReady(event: { readonly type: string; readonly data?: unknown }): boolean {
  if (event.type !== ANTIGRAVITY_SESSION_READY || event.data === null || typeof event.data !== 'object') return false
  return (event.data as { readonly provider?: unknown }).provider === ANTIGRAVITY_PROVIDER_KEY
}

/** Project the first successful native Antigravity session startup into a durable lock node. */
export const antigravityRuntimeLockEvent: ConversationNodeDefinition<typeof ANTIGRAVITY_PROVIDER_KEY> = {
  kind: 'model-switch.antigravity-runtime-lock',
  target: RUNTIME_LOCK_TARGET,
  match: event => isSessionReady(event) ? { id: ANTIGRAVITY_PROVIDER_KEY, role: 'start' } : null,
  start: () => ANTIGRAVITY_PROVIDER_KEY,
  update: context => context.state,
  buildViewNode: context => context.state === undefined ? null : {
    key: context.key,
    kind: context.kind,
    id: context.id,
    target: RUNTIME_LOCK_TARGET,
    data: context.state,
  },
}

/** Fold runtime-lock nodes into the provider allowed for the rest of the Session. */
export const antigravityRuntimeLockView: ConversationViewDefinition<RuntimeLockNode, RuntimeProviderLock> = {
  target: RUNTIME_LOCK_TARGET,
  create: () => {
    let current: RuntimeProviderLock = null
    return {
      empty: null,
      replace: ({ nodes }) => {
        current = nodes.some(node => node.data === ANTIGRAVITY_PROVIDER_KEY) ? ANTIGRAVITY_PROVIDER_KEY : null
        return current
      },
      apply: ({ upserts }) => {
        if (upserts.some(node => node.data === ANTIGRAVITY_PROVIDER_KEY)) current = ANTIGRAVITY_PROVIDER_KEY
        return current
      },
    }
  },
  isActive: () => false,
}

/** Whether one provider remains selectable under the Session runtime lock. */
export function providerSelectable(lock: RuntimeProviderLock, provider: string): boolean {
  return lock === null || provider === lock
}

/** Register the replayable event projection when Conversation assembly is present. */
export function installAntigravityRuntimeLock(ctx: ClientContext): void {
  ctx.inject(['uiConversation'], (scope) => {
    scope.effect(() => scope.uiConversation.views.register(antigravityRuntimeLockView), 'dsh-model-switch: Antigravity runtime lock view')
    scope.effect(() => scope.uiConversation.events.register(antigravityRuntimeLockEvent), 'dsh-model-switch: Antigravity runtime lock event')
  })
}
