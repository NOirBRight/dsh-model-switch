/** Durable provider lock projected from Antigravity session startup. */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import type { ConversationNodeDefinition, ConversationViewDefinition, ConversationViewNode } from '@deepseek-ai/dsh-client-ui-conversation/client';
import { ANTIGRAVITY_PROVIDER_KEY } from './antigravity-catalog.ts';
export declare const ANTIGRAVITY_SESSION_READY = "antigravity/session-ready";
export declare const RUNTIME_LOCK_TARGET = "model-switch.runtime-lock";
export type RuntimeProviderLock = typeof ANTIGRAVITY_PROVIDER_KEY | null;
interface RuntimeLockNode extends ConversationViewNode {
    readonly target: typeof RUNTIME_LOCK_TARGET;
    readonly data: typeof ANTIGRAVITY_PROVIDER_KEY;
}
declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
    interface ConversationViewSnapshotMap {
        'model-switch.runtime-lock': RuntimeProviderLock;
    }
}
/** Project the first successful native Antigravity session startup into a durable lock node. */
export declare const antigravityRuntimeLockEvent: ConversationNodeDefinition<typeof ANTIGRAVITY_PROVIDER_KEY>;
/** Fold runtime-lock nodes into the provider allowed for the rest of the Session. */
export declare const antigravityRuntimeLockView: ConversationViewDefinition<RuntimeLockNode, RuntimeProviderLock>;
/** Whether one provider remains selectable under the Session runtime lock. */
export declare function providerSelectable(lock: RuntimeProviderLock, provider: string): boolean;
/** Register the replayable event projection when Conversation assembly is present. */
export declare function installAntigravityRuntimeLock(ctx: ClientContext): void;
export {};
