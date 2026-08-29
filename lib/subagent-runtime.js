import { ReasoningEffortId } from "@deepseek-ai/dsh-llm";
import OfficialSubagentRuntime from "@deepseek-ai/dsh-subagent";
//#region lib/types/subagent-runtime.js
var SubagentRouteUnavailableError = class extends Error {
	name = "SubagentRouteUnavailableError";
};
function present(value) {
	return typeof value === "string" && value.trim() !== "";
}
function explicitRoute(options) {
	const effortCapable = options;
	const provider = effortCapable?.provider;
	const model = effortCapable?.model;
	if (present(provider) && present(model)) return {
		provider,
		model,
		...effortCapable?.reasoningEffort === void 0 ? {} : { reasoningEffort: effortCapable.reasoningEffort }
	};
	if (present(provider) || present(model)) throw new SubagentRouteUnavailableError("explicit Subagent routes require both provider and model");
}
function providerModel(selection, source) {
	if (!present(selection.provider) || !present(selection.model)) throw new SubagentRouteUnavailableError(source + " must provide non-empty provider and model");
	return {
		provider: selection.provider,
		model: selection.model,
		...selection.reasoningEffort === void 0 ? {} : { reasoningEffort: selection.reasoningEffort }
	};
}
function fixedRoute(settings) {
	if (!present(settings.subagentProvider) || !present(settings.subagentModel)) throw new SubagentRouteUnavailableError("fixed Subagent policy requires non-empty subagentProvider and subagentModel");
	return {
		provider: settings.subagentProvider,
		model: settings.subagentModel,
		...present(settings.subagentReasoningEffort) ? { reasoningEffort: ReasoningEffortId(settings.subagentReasoningEffort) } : {}
	};
}
function parentRoute(request) {
	const header = request.parent.session.requestHeader()?.config;
	if (header !== void 0 && present(header.provider) && present(header.model)) return {
		provider: header.provider,
		model: header.model,
		...header.reasoningEffort === void 0 ? {} : { reasoningEffort: header.reasoningEffort }
	};
	return explicitRoute(request.parent.options);
}
/** Resolve and snapshot the route that must exist before official descriptor creation. */
function routeSubagentRequest(request, settings, main) {
	if (explicitRoute(request.agentOptions) !== void 0) return request;
	const fromParent = settings.subagentMode === "follow-main" ? parentRoute(request) : void 0;
	const selected = settings.subagentMode === "fixed" ? fixedRoute(settings) : providerModel(fromParent ?? main, fromParent === void 0 ? "Main default" : "parent route");
	return {
		...request,
		agentOptions: {
			...request.agentOptions,
			provider: selected.provider,
			model: selected.model,
			...selected.reasoningEffort === void 0 ? {} : { reasoningEffort: selected.reasoningEffort }
		}
	};
}
/** Official rc.2 runtime with only a pre-descriptor route-selection adapter. */
var ModelSwitchSubagentRuntime = class extends OfficialSubagentRuntime {
	static inject = ["modelSwitch"];
	routed(request) {
		return routeSubagentRequest(request, this.ctx.modelSwitch.currentSettings(), this.ctx.modelSwitch.currentMainSelection());
	}
	start(name, request) {
		return super.start(name, this.routed(request));
	}
	startContinuable(spec) {
		return super.startContinuable({
			...spec,
			request: this.routed(spec.request)
		});
	}
};
//#endregion
export { ModelSwitchSubagentRuntime, ModelSwitchSubagentRuntime as default, SubagentRouteUnavailableError, routeSubagentRequest };
