import z from "@deepseek-ai/schemastery";
import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";
import { Service } from "@deepseek-ai/cordis";
//#region lib/types/client-contract.js
const MODEL_SWITCH_SETTINGS_ID = "model-switch";
Object.freeze({
	mode: "subagentMode",
	provider: "subagentProvider",
	model: "subagentModel"
});
//#endregion
//#region lib/types/host-settings.js
const MODEL_SWITCH_SETTINGS_NAMESPACE = settingsNamespace(MODEL_SWITCH_SETTINGS_ID);
const Config = z.object({
	subagentMode: z.union(["follow-main", "fixed"]).default("follow-main"),
	subagentProvider: z.string(),
	subagentModel: z.string(),
	subagentReasoningEffort: z.string()
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
		available: false,
		reason: "tool-owner-suppression"
	}),
	visionProviderAdapters: Object.freeze({
		available: false,
		reason: "vision-provider-adapters"
	}),
	imageProviderAdapters: Object.freeze({
		available: false,
		reason: "image-provider-adapters"
	})
});
//#endregion
//#region lib/types/host-runtime.js
/** Host owner for Model Switch settings and the released Main-default adapter. */
var ModelSwitchRuntime = class extends Service {
	static inject = ["agentDefaultModel"];
	static Config = Config;
	capabilities = RUNTIME_CAPABILITIES;
	source;
	constructor(ctx, entry) {
		super(ctx, "modelSwitch");
		this.source = () => entry;
		installSettingsSection(ctx, MODEL_SWITCH_SETTINGS_NAMESPACE, Config, entry, {
			setSource: (current) => {
				this.source = current;
			},
			onChange: () => {}
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
export { Config, MODEL_SWITCH_SETTINGS_NAMESPACE, ModelSwitchRuntime, ModelSwitchRuntime as default, RUNTIME_CAPABILITIES, mainDefaultPort, name };
