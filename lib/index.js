import { ModelSwitchAdapterRegistry } from "./adapter-registry.js";
import z from "@deepseek-ai/schemastery";
import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";
import { Service } from "@deepseek-ai/cordis";
import { defineTool } from "@deepseek-ai/dsh-tools";
//#region lib/types/client-contract.js
const MODEL_SWITCH_SETTINGS_ID = "model-switch";
Object.freeze({
	mode: "subagentMode",
	provider: "subagentProvider",
	model: "subagentModel"
});
Object.freeze({
	provider: "searchProvider",
	model: "searchModel"
});
Object.freeze({
	provider: "imageProvider",
	model: "imageModel"
});
//#endregion
//#region lib/types/host-settings.js
const MODEL_SWITCH_SETTINGS_NAMESPACE = settingsNamespace(MODEL_SWITCH_SETTINGS_ID);
const Config = z.object({
	subagentMode: z.union(["follow-main", "fixed"]).default("follow-main"),
	subagentProvider: z.string(),
	subagentModel: z.string(),
	subagentReasoningEffort: z.string(),
	searchProvider: z.string(),
	searchModel: z.string(),
	imageProvider: z.string(),
	imageModel: z.string()
});
//#endregion
//#region lib/types/runtime-capabilities.js
const RUNTIME_CAPABILITIES = Object.freeze({
	mainDefaults: Object.freeze({ available: true }),
	settings: Object.freeze({ available: true }),
	centralSubagentRouting: Object.freeze({ available: true }),
	packagedPresetRoots: Object.freeze({
		available: false,
		reason: "packaged-preset-roots"
	}),
	toolOwnerSuppression: Object.freeze({
		available: false,
		reason: "tool-owner-suppression"
	}),
	searchProviderAdapters: Object.freeze({
		available: true,
		providers: Object.freeze(["codex"])
	}),
	visionProviderAdapters: Object.freeze({
		available: false,
		reason: "vision-provider-adapters"
	}),
	imageProviderAdapters: Object.freeze({
		available: true,
		providers: Object.freeze(["codex", "grok"])
	})
});
//#endregion
//#region lib/types/search-provider.js
const MODEL_SWITCH_SEARCH_PROVIDER_ID = "model-switch";
function selected$1(settings) {
	const provider = settings.searchProvider?.trim();
	const model = settings.searchModel?.trim();
	if (provider === void 0 || provider === "" || model === void 0 || model === "") return void 0;
	return {
		provider,
		model
	};
}
/** Thin official WebSearchProvider that resolves Model Switch routing at execution time. */
var ModelSwitchSearchProvider = class {
	settings;
	adapters;
	id = MODEL_SWITCH_SEARCH_PROVIDER_ID;
	constructor(settings, adapters) {
		this.settings = settings;
		this.adapters = adapters;
	}
	available() {
		const route = selected$1(this.settings());
		if (route === void 0) return false;
		const adapter = this.adapters.get(route.provider)?.search;
		return adapter !== void 0 && adapter.supportsModel(route.model);
	}
	async search(request, signal) {
		const route = selected$1(this.settings());
		if (route === void 0) throw new Error("search provider and model must be configured in Model Switch");
		const adapter = this.adapters.get(route.provider)?.search;
		if (adapter === void 0) throw new Error("missing search adapter: " + route.provider);
		if (!adapter.supportsModel(route.model)) throw new Error("search model is not supported by adapter: " + route.provider + "/" + route.model);
		return adapter.search(route.model, request, signal);
	}
};
function installModelSwitchSearchProvider(ctx, runtime) {
	ctx.inject(["web"], (scope) => scope.effect(() => scope.web.registerSearchProvider(new ModelSwitchSearchProvider(() => runtime.currentSettings(), runtime.adapters)), "Model Switch: register thin Search provider"));
}
//#endregion
//#region lib/types/image-tool.js
const GENERATE_IMAGE_TOOL_NAME = "generate_image";
function selected(settings) {
	const provider = settings.imageProvider?.trim();
	const model = settings.imageModel?.trim();
	if (provider === void 0 || provider === "" || model === void 0 || model === "") throw new Error("image provider and model must be configured in Model Switch");
	return {
		provider,
		model
	};
}
function optional(value) {
	return typeof value === "string" && value.trim() !== "" ? value : void 0;
}
function validateGenerated(value) {
	if (typeof value !== "object" || value === null) throw new Error("image adapter returned invalid metadata");
	if (typeof value.path !== "string" || value.path.trim() === "") throw new Error("image adapter returned empty path");
	if (![
		"image/png",
		"image/jpeg",
		"image/webp",
		"image/gif"
	].includes(value.mediaType)) throw new Error("image adapter returned invalid media type");
	if (!Number.isInteger(value.width) || value.width <= 0 || !Number.isInteger(value.height) || value.height <= 0) throw new Error("image adapter returned invalid dimensions");
	if (value.bytes !== void 0 && (!Number.isInteger(value.bytes) || value.bytes <= 0)) throw new Error("image adapter returned invalid byte count");
	if (value.attachmentId !== void 0 && (typeof value.attachmentId !== "string" || value.attachmentId.trim() === "")) throw new Error("image adapter returned invalid attachment id");
	return value;
}
function createGenerateImageTool(runtime) {
	const schemaProvider = runtime.currentSettings().imageProvider?.trim();
	const parameters = {
		prompt: {
			type: "string",
			required: true,
			description: "Detailed image prompt."
		},
		path: {
			type: "string",
			description: "Optional workspace-relative destination."
		},
		...schemaProvider === "codex" ? {
			source: {
				type: "string",
				description: "Optional source image for editing. Omit for a new image."
			},
			outputFormat: {
				type: "string",
				enum: [
					"png",
					"jpeg",
					"webp"
				],
				description: "Output format."
			}
		} : {},
		...schemaProvider === "grok" ? { aspectRatio: {
			type: "string",
			description: "Optional Grok aspect ratio, for example 1:1 or 16:9."
		} } : {}
	};
	return defineTool({
		name: GENERATE_IMAGE_TOOL_NAME,
		description: schemaProvider === "codex" ? "Generate or edit a raster image through the Codex model selected in Model Switch." : schemaProvider === "grok" ? "Generate a raster image through the Grok model selected in Model Switch." : "Generate a raster image through the provider and model selected in Model Switch.",
		parameters,
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					provider: {
						type: "string",
						required: true
					},
					model: {
						type: "string",
						required: true
					},
					path: {
						type: "string",
						required: true
					},
					mediaType: {
						type: "string",
						required: true
					},
					width: {
						type: "integer",
						required: true
					},
					height: {
						type: "integer",
						required: true
					},
					bytes: { type: "integer" },
					attachmentId: { type: "string" },
					name: { type: "string" },
					revisedPrompt: { type: "string" }
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: value.path
			}]
		},
		async execute(rawArgs, execution) {
			const args = rawArgs;
			if (typeof args.prompt !== "string" || args.prompt.trim() === "") throw new Error("image prompt must be non-empty");
			const route = selected(runtime.currentSettings());
			const path = optional(args.path);
			const source = optional(args.source);
			const aspectRatio = optional(args.aspectRatio);
			const outputFormat = optional(args.outputFormat);
			if (route.provider === "codex" && aspectRatio !== void 0) throw new Error("Codex image generation does not accept aspectRatio");
			if (route.provider === "grok" && (source !== void 0 || outputFormat !== void 0)) throw new Error("Grok image generation does not accept source or outputFormat");
			if (route.provider !== "codex" && route.provider !== "grok") throw new Error("image provider must be codex or grok");
			const adapter = runtime.adapters.get(route.provider)?.image;
			if (adapter === void 0) throw new Error("missing image adapter: " + route.provider);
			if (!adapter.supportsModel(route.model)) throw new Error("image model is not supported by adapter: " + route.provider + "/" + route.model);
			const request = {
				prompt: args.prompt,
				...path === void 0 ? {} : { path },
				...source === void 0 ? {} : { source },
				...outputFormat === void 0 ? {} : { outputFormat },
				...aspectRatio === void 0 ? {} : { aspectRatio }
			};
			const generated = validateGenerated(await adapter.generate(route.model, request, execution));
			return {
				provider: route.provider,
				model: route.model,
				...generated
			};
		}
	});
}
/** Registers one provider-specific schema and replaces it transactionally on Settings changes. */
function installGenerateImageTool(ctx, runtime) {
	let register;
	let current;
	let tail = Promise.resolve();
	const replace = () => {
		if (register === void 0) return;
		const next = createGenerateImageTool(runtime);
		const previous = current;
		previous?.dispose();
		try {
			current = {
				tool: next,
				dispose: register(next)
			};
		} catch (error) {
			current = previous === void 0 ? void 0 : {
				tool: previous.tool,
				dispose: register(previous.tool)
			};
			throw error;
		}
	};
	const controller = { reconcile() {
		const operation = tail.then(replace, replace);
		tail = operation.catch(() => {});
		return operation;
	} };
	ctx.inject(["tools"], (scope) => {
		register = (tool) => scope.tools.register(tool);
		replace();
		return () => {
			current?.dispose();
			current = void 0;
			register = void 0;
		};
	});
	return controller;
}
//#endregion
//#region lib/types/host-runtime.js
/** Host owner for Model Switch settings and the released Main-default adapter. */
var ModelSwitchRuntime = class extends Service {
	static inject = ["agentDefaultModel"];
	static Config = Config;
	capabilities = RUNTIME_CAPABILITIES;
	adapters = new ModelSwitchAdapterRegistry();
	source;
	constructor(ctx, entry) {
		super(ctx, "modelSwitch");
		this.source = () => entry;
		installModelSwitchSearchProvider(ctx, this);
		const imageTool = installGenerateImageTool(ctx, this);
		installSettingsSection(ctx, MODEL_SWITCH_SETTINGS_NAMESPACE, Config, entry, {
			setSource: (current) => {
				this.source = current;
			},
			onChange: () => {
				imageTool.reconcile().catch((error) => {
					ctx.logger.error("Model Switch: failed to regenerate generate_image schema");
					ctx.logger.error(error);
				});
			}
		});
	}
	currentSettings() {
		return { ...this.source() };
	}
	currentMainSelection() {
		return { ...this.ctx.agentDefaultModel.currentSelection() };
	}
	async saveMainSelection(selection) {
		await this.ctx.agentDefaultModel.saveSelection(selection);
	}
};
function mainDefaultPort(service) {
	return {
		currentSelection: () => ({ ...service.currentSelection() }),
		saveSelection: async (selection) => service.saveSelection(selection)
	};
}
//#endregion
//#region lib/types/index.js
const name = "dsh-model-switch";
//#endregion
export { Config, MODEL_SWITCH_SETTINGS_NAMESPACE, ModelSwitchAdapterRegistry, ModelSwitchRuntime, ModelSwitchRuntime as default, RUNTIME_CAPABILITIES, mainDefaultPort, name };
