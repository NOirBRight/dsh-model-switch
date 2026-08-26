import { resolveDefaultEffort, validateModelSelection } from "./capabilities.js";
//#region lib/types/subagent-route-policy.js
function parsePolicy(catalog, policy) {
	if (policy.mode === "follow-main") return { mode: "follow-main" };
	if (policy.mode === "fixed") return {
		mode: "fixed",
		route: validateModelSelection(catalog, policy.route)
	};
	throw new Error("subagent policy mode must be follow-main or fixed");
}
function workflowSelection(override) {
	return override.effort === void 0 ? {
		provider: override.provider,
		model: override.model
	} : {
		provider: override.provider,
		model: override.model,
		reasoningEffort: override.effort
	};
}
function createSubagentRouteSnapshot(catalog, input) {
	if (input.workflowOverride !== void 0) return {
		version: 1,
		source: "workflow-override",
		selection: resolveDefaultEffort(catalog, validateModelSelection(catalog, workflowSelection(input.workflowOverride)))
	};
	const policy = parsePolicy(catalog, input.policy);
	if (policy.mode === "fixed") return {
		version: 1,
		source: "fixed-policy",
		selection: resolveDefaultEffort(catalog, policy.route)
	};
	if (input.parentRequestHeaderSelection !== void 0) return {
		version: 1,
		source: "parent-request-header",
		selection: resolveDefaultEffort(catalog, validateModelSelection(catalog, input.parentRequestHeaderSelection))
	};
	return {
		version: 1,
		source: "main-fallback",
		selection: resolveDefaultEffort(catalog, validateModelSelection(catalog, input.main.defaultRoute))
	};
}
function restoreSubagentRouteSnapshot(catalog, input) {
	if (typeof input !== "object" || input === null || Array.isArray(input)) throw new Error("subagent route snapshot must be an object");
	const value = input;
	if (value.version !== 1) throw new Error("subagent route snapshot version must be 1");
	if (![
		"parent-request-header",
		"main-fallback",
		"fixed-policy",
		"workflow-override"
	].includes(String(value.source))) throw new Error("subagent route snapshot source is invalid");
	return {
		version: 1,
		source: value.source,
		selection: validateModelSelection(catalog, value.selection)
	};
}
//#endregion
export { createSubagentRouteSnapshot, restoreSubagentRouteSnapshot };
