import type { ModelSelection } from '@deepseek-ai/dsh-agent';
import OfficialSubagentRuntime, { type ContinuableStart, type ContinuableStartSpec, type SubagentRun, type SubagentStartRequest } from '@deepseek-ai/dsh-subagent';
import type { Config } from './host-settings.js';
export declare class SubagentRouteUnavailableError extends Error {
    readonly name = "SubagentRouteUnavailableError";
}
type RoutableSubagentRequest = Pick<SubagentStartRequest, 'parent' | 'agentOptions'>;
/** Resolve and snapshot the route that must exist before official descriptor creation. */
export declare function routeSubagentRequest<T extends RoutableSubagentRequest>(request: T, settings: Config, main: ModelSelection): T;
/** Official rc.2 runtime with only a pre-descriptor route-selection adapter. */
export declare class ModelSwitchSubagentRuntime extends OfficialSubagentRuntime {
    static inject: string[];
    private routed;
    start(name: string, request: SubagentStartRequest): Promise<SubagentRun>;
    startContinuable(spec: ContinuableStartSpec): Promise<ContinuableStart>;
}
export default ModelSwitchSubagentRuntime;
