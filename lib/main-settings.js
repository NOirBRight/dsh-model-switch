import { parseReasoningEffortId, resolveDefaultEffort, validateModelSelection } from "./capabilities.js";
//#region lib/types/main-settings.js
function routeShape(input) {
	if (typeof input !== "object" || input === null || Array.isArray(input)) throw new Error("Main default route must be an object");
	const value = input;
	if (typeof value.provider !== "string" || value.provider.trim() === "") throw new Error("Main default provider must be a non-empty string");
	if (typeof value.model !== "string" || value.model.trim() === "") throw new Error("Main default model must be a non-empty string");
	if (value.reasoningEffort !== void 0 && (typeof value.reasoningEffort !== "string" || value.reasoningEffort.trim() === "")) throw new Error("Main default reasoningEffort must be a non-empty string when present");
	return {
		provider: value.provider,
		model: value.model,
		...value.reasoningEffort === void 0 ? {} : { reasoningEffort: parseReasoningEffortId(value.reasoningEffort) }
	};
}
/** Decode storage without resolving availability, so invalid/uninstalled choices remain visible. */
function parseMainSettingsDocument(input) {
	if (typeof input !== "object" || input === null || Array.isArray(input)) throw new Error("Main settings must be an object");
	const value = input;
	if (value.version !== 1) throw new Error("Main settings version must be 1");
	return {
		version: 1,
		defaultRoute: routeShape(value.defaultRoute)
	};
}
/** Validate only when a caller creates a new session; existing sessions never re-read this document. */
function routeForNewSession(catalog, settings) {
	return resolveDefaultEffort(catalog, validateModelSelection(catalog, settings.defaultRoute));
}
//#endregion
export { parseMainSettingsDocument, routeForNewSession };
