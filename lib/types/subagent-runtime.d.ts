import { Context } from '@deepseek-ai/cordis';
import type { ModelSelection } from '@deepseek-ai/dsh-agent';
import OfficialSubagentRuntime, { type ContinuableStart, type ContinuableStartSpec, type SubagentRun, type SubagentStartRequest } from '@deepseek-ai/dsh-subagent';
import type { Config } from './host-settings.js';
/** Raised only when an explicit startup check finds an unsupported public surface. */
export declare class StartupIncompatibilityError extends Error {
    readonly name = "StartupIncompatibilityError";
    readonly surface: string;
    /**
     * @param surfaceOrMessage - the incompatible public surface, or the error message.
     * @param message - the missing or incompatible requirement.
     */
    constructor(surfaceOrMessage: string, message?: string);
}
/** Raised when the selected policy cannot produce a complete provider/model route. */
export declare class SubagentRouteUnavailableError extends Error {
    readonly name = "SubagentRouteUnavailableError";
}
/** One idempotent cleanup operation tracked during runtime startup. */
export type StartupDisposer = () => void | PromiseLike<void>;
/** Register one cleanup operation for a startup attempt. */
export type StartupCleanupTracker = (dispose: StartupDisposer) => void;
/** A successfully mounted runtime and its idempotent cleanup operation. */
export interface MountedStartup<T> {
    readonly value: T;
    readonly dispose: () => Promise<void>;
}
type RoutableSubagentRequest = Pick<SubagentStartRequest, 'parent' | 'agentOptions'>;
/** Resolve and snapshot the route that must exist before official descriptor creation. */
export declare function routeSubagentRequest<T extends RoutableSubagentRequest>(request: T, settings: Config, main: ModelSelection): T;
/**
 * Mount a candidate and use the fallback only for typed startup incompatibility.
 *
 * Every resource registered by an attempt is disposed in reverse order before a
 * fallback starts and again when the mounted result is disposed. Cleanup keeps
 * running after failures, and a startup error stays first in any aggregate.
 *
 * @param candidate - startup callback for the routed candidate.
 * @param fallback - startup callback for the untouched official runtime.
 * @returns the selected value and an idempotent disposer.
 * @throws the candidate error unless it is a StartupIncompatibilityError.
 * @throws the fallback startup error when fallback startup fails.
 */
export declare function mountWithStartupFallback<T>(candidate: (track: StartupCleanupTracker) => Promise<T>, fallback: (track: StartupCleanupTracker) => Promise<T>): Promise<MountedStartup<T>>;
/** Profile replacement that selects the routed runtime or the untouched official runtime. */
export declare const profileSubagentRuntime: ((ctx: Context) => Promise<() => Promise<void>>) & {
    inject: string[];
};
/** Official runtime with only a pre-descriptor route-selection adapter. */
export declare class ModelSwitchSubagentRuntime extends OfficialSubagentRuntime {
    static inject: string[];
    private routed;
    start(name: string, request: SubagentStartRequest): Promise<SubagentRun>;
    startContinuable(spec: ContinuableStartSpec): Promise<ContinuableStart>;
}
export default profileSubagentRuntime;
