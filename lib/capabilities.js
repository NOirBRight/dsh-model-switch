import { ReasoningEffortId } from "@deepseek-ai/dsh-llm";
//#region lib/types/capabilities.js
var CapabilityValidationError = class extends Error {
	name = "CapabilityValidationError";
};
function record(value, label) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new CapabilityValidationError(label + " must be an object");
	return value;
}
function nonEmpty(value, label) {
	if (typeof value !== "string" || value.trim() === "") throw new CapabilityValidationError(label + " must be a non-empty string");
	return value;
}
function parseReasoningEffortId(value, label = "reasoningEffort") {
	return ReasoningEffortId(nonEmpty(value, label));
}
function defineCapabilityCatalog(catalog) {
	const providers = record(catalog.providers, "providers");
	for (const [providerId, providerValue] of Object.entries(providers)) {
		nonEmpty(providerId, "provider id");
		const models = record(record(providerValue, "provider " + providerId).models, "provider " + providerId + ".models");
		for (const [modelId, modelValue] of Object.entries(models)) {
			nonEmpty(modelId, "model id");
			const label = providerId + "/" + modelId;
			const model = record(modelValue, label);
			if (!Array.isArray(model.capabilities) || model.capabilities.length === 0) throw new CapabilityValidationError(label + " must declare capabilities");
			for (const capability of model.capabilities) if (![
				"chat",
				"search",
				"vision",
				"image"
			].includes(String(capability))) throw new CapabilityValidationError(label + " has an unknown capability");
			const efforts = model.reasoningEfforts === void 0 ? [] : model.reasoningEfforts;
			if (!Array.isArray(efforts)) throw new CapabilityValidationError(label + ".reasoningEfforts must be an array");
			const parsedEfforts = efforts.map((item) => parseReasoningEffortId(item, label + ".reasoningEfforts"));
			if (new Set(parsedEfforts).size !== parsedEfforts.length) throw new CapabilityValidationError(label + ".reasoningEfforts contains duplicates");
			if (model.defaultReasoningEffort !== void 0 && !parsedEfforts.includes(parseReasoningEffortId(model.defaultReasoningEffort, label + ".defaultReasoningEffort"))) throw new CapabilityValidationError(label + ".defaultReasoningEffort must be listed in efforts");
		}
	}
	return catalog;
}
function validateModelSelection(catalog, input, requiredCapability = "chat") {
	const value = record(input, "model selection");
	const provider = nonEmpty(value.provider, "provider");
	const model = nonEmpty(value.model, "model");
	const providerCapabilities = catalog.providers[provider];
	if (providerCapabilities === void 0) throw new CapabilityValidationError("unknown provider: " + provider);
	const modelCapabilities = providerCapabilities.models[model];
	if (modelCapabilities === void 0) throw new CapabilityValidationError("unknown model: " + provider + "/" + model);
	if (!modelCapabilities.capabilities.includes(requiredCapability)) throw new CapabilityValidationError(provider + "/" + model + " does not support " + requiredCapability);
	if (value.reasoningEffort === void 0) return {
		provider,
		model
	};
	const selectedEffort = parseReasoningEffortId(value.reasoningEffort, "reasoningEffort");
	if (!(modelCapabilities.reasoningEfforts ?? []).includes(selectedEffort)) throw new CapabilityValidationError(provider + "/" + model + " does not support reasoning effort " + selectedEffort);
	return {
		provider,
		model,
		reasoningEffort: selectedEffort
	};
}
function resolveDefaultEffort(catalog, selection) {
	const validated = validateModelSelection(catalog, selection);
	if (validated.reasoningEffort !== void 0) return validated;
	const defaultEffort = catalog.providers[validated.provider]?.models[validated.model]?.defaultReasoningEffort;
	return defaultEffort === void 0 ? validated : {
		...validated,
		reasoningEffort: defaultEffort
	};
}
//#endregion
export { CapabilityValidationError, defineCapabilityCatalog, parseReasoningEffortId, resolveDefaultEffort, validateModelSelection };
