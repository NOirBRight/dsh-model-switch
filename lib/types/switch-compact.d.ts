/** Send-time context check and optional old-model compaction before a switched request. */
import type { Context } from '@deepseek-ai/cordis';
import { type UserMessage } from '@deepseek-ai/dsh-llm';
/** Provider and model selected for one model-routed request. */
export interface SwitchRoute {
    readonly provider: string;
    readonly model: string;
}
/**
 * Compare two fully specified model routes.
 * @param left - first route, if one was resolved.
 * @param right - second route, if one was resolved.
 * @returns Whether both routes identify the same provider and model.
 */
export declare function sameSwitchRoute(left: SwitchRoute | undefined, right: SwitchRoute | undefined): boolean;
/**
 * Decide whether a changed, complete route needs send-time context protection.
 * @param enabled - whether the user enabled send-time protection.
 * @param previous - route used by the preceding request.
 * @param selected - route assembled for the pending request.
 * @returns Whether the pending request changes its provider or model.
 */
export declare function shouldProtectSwitch(enabled: boolean, previous: SwitchRoute | undefined, selected: SwitchRoute | undefined): boolean;
/**
 * Input budget for the target window. Reserves output (maxTokens or 20%) plus a
 * fixed estimator margin. `undefined` means the window cannot be used.
 * @param contextWindow - adapter-owned combined request/response capacity.
 * @param maxTokens - optional generation cap from the live agent options.
 * @returns Tokens available to the request input, or undefined for an invalid window.
 */
export declare function switchInputBudget(contextWindow: number, maxTokens?: number): number | undefined;
/**
 * Determine whether an estimated input exceeds its target route budget.
 * @param tokens - estimated input tokens.
 * @param budget - input budget for the target window.
 * @returns Whether the budget is unusable or the estimate is too large.
 */
export declare function overSwitchBudget(tokens: number, budget: number): boolean;
/**
 * Build one transcript-visible Model Switch progress notice.
 * @param text - localized notice text shown in the transcript.
 * @param summary - bounded event summary for durable session metadata.
 * @returns A plugin-authored user message for the session log.
 */
export declare function switchNotice(text: string, summary: string): UserMessage;
/**
 * Extract a complete route from partial request configuration.
 * @param value - candidate provider and model values.
 * @returns A complete route, or undefined when either identifier is absent.
 */
export declare function routeOf(value: {
    provider?: string;
    model?: string;
} | undefined): SwitchRoute | undefined;
/**
 * Install send-time switch protection on the host context.
 * @param ctx - host context that owns agent-loop, llm, and tokenMeter.
 * @param settings - live Model Switch settings; `compactOnSwitch !== false` is on.
 * @param roleOf - provider-role lookup used to exclude native Agent runtimes.
 */
export declare function installSwitchCompaction(ctx: Context, settings: () => {
    compactOnSwitch?: boolean;
}, roleOf?: (provider: string) => 'llm' | 'agent' | undefined): void;
