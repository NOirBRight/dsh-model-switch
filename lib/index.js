import { ModelSwitchAdapterRegistry } from "./adapter-registry.js";
import { createRequire } from "node:module";
import z from "@deepseek-ai/schemastery";
import { Service } from "@deepseek-ai/cordis";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { clientRequestSchema } from "@deepseek-ai/dsh-client-connection";
import { credentialRef, isCredentialRefName } from "@deepseek-ai/dsh-credentials";
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";
import { Config as Config$1, DEEPSEEK_DEFAULT_API_VERSION, DEEPSEEK_DEFAULT_BASE_URL, DEEPSEEK_DEFAULT_MAX_TOKENS, DEEPSEEK_DEFAULT_MAX_USES, DEEPSEEK_DEFAULT_MODEL, DEEPSEEK_PROVIDER_ID, DeepSeekSearchProvider, WEB_SEARCH_DEEPSEEK_SETTINGS_NAMESPACE } from "@deepseek-ai/dsh-web-search-deepseek";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { renderPrompt } from "@deepseek-ai/dsh-system-prompt";
import { boundContextSummary, createMessage, createUserMessage } from "@deepseek-ai/dsh-llm";
import { canonicalHeader } from "@deepseek-ai/dsh-session";
//#region lib/types/host-settings.js
const Config = z.object({
	subagentMode: z.union(["follow-main", "fixed"]).default("follow-main").volatile(),
	subagentProvider: z.string().volatile(),
	subagentModel: z.string().volatile(),
	subagentReasoningEffort: z.string().volatile(),
	searchProvider: z.string().volatile(),
	searchModel: z.string().volatile(),
	imageProvider: z.string().volatile(),
	imageModel: z.string().volatile(),
	compactOnSwitch: z.boolean().default(true).volatile()
});
function readConfig(config) {
	const subagentProvider = config.subagentProvider.get();
	const subagentModel = config.subagentModel.get();
	const subagentReasoningEffort = config.subagentReasoningEffort.get();
	const searchProvider = config.searchProvider.get();
	const searchModel = config.searchModel.get();
	const imageProvider = config.imageProvider.get();
	const imageModel = config.imageModel.get();
	return {
		subagentMode: config.subagentMode.get(),
		...subagentProvider === void 0 ? {} : { subagentProvider },
		...subagentModel === void 0 ? {} : { subagentModel },
		...subagentReasoningEffort === void 0 ? {} : { subagentReasoningEffort },
		...searchProvider === void 0 ? {} : { searchProvider },
		...searchModel === void 0 ? {} : { searchModel },
		...imageProvider === void 0 ? {} : { imageProvider },
		...imageModel === void 0 ? {} : { imageModel },
		compactOnSwitch: config.compactOnSwitch.get()
	};
}
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
		reason: "search-provider-adapters",
		providers: Object.freeze([])
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
function statusResponse(status) {
	return new Response(status === 415 ? "Unsupported Media Type" : status === 500 ? "Internal Server Error" : "Bad Request", { status });
}
function binaryResponse(rpcId, result) {
	const response = {
		type: "server-response",
		rpcId,
		result
	};
	if (!result.ok) return Response.json(response);
	const { attachments, ...value } = result;
	const envelope = {
		...response,
		result: value
	};
	if (attachments === void 0 || attachments.length === 0) return Response.json(envelope);
	const parts = new FormData();
	const attachmentMetadata = attachments.map((attachment, index) => {
		const part = `bytes-${index}`;
		parts.set(part, new Blob([new Uint8Array(attachment.bytes)]));
		return {
			path: [...attachment.path],
			codec: "bytes",
			part
		};
	});
	parts.set("metadata", JSON.stringify({
		...envelope,
		attachments: attachmentMetadata
	}));
	return new Response(parts);
}
async function handleFetchRpc(request, handler, operator) {
	if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") return statusResponse(415);
	let body;
	try {
		body = await request.json();
	} catch {
		return statusResponse(400);
	}
	const parsed = clientRequestSchema.safeParse(body);
	if (!parsed.success || parsed.data.method !== "plugin-rpc/model-switch") return statusResponse(400);
	const wrapped = parsed.data.payload;
	if (typeof wrapped !== "object" || wrapped === null || Array.isArray(wrapped)) return statusResponse(400);
	if (Object.keys(wrapped).some((key) => key !== "endpoint" && key !== "payload")) return statusResponse(400);
	const { endpoint, payload } = wrapped;
	if (typeof endpoint !== "string") return statusResponse(400);
	try {
		const result = await handler(endpoint, payload, request.signal, operator);
		return binaryResponse(parsed.data.rpcId, result);
	} catch {
		return statusResponse(500);
	}
}
/** Bounded long-poll on the existing registry; each caller owns and disposes its subscription. */
function capabilitiesRpc(registry, snapshot, lifetime) {
	let revision = 0;
	let previous;
	const read = () => {
		const capabilities = snapshot();
		const signature = JSON.stringify(capabilities);
		if (previous !== void 0 && signature !== previous) revision++;
		previous = signature;
		return {
			revision,
			capabilities
		};
	};
	return async (endpoint, payload, signal) => {
		if (endpoint !== "capabilities") return {
			ok: false,
			error: {
				details: {},
				code: "unknown-endpoint",
				message: "Unknown Model Switch endpoint"
			}
		};
		if (payload === null || typeof payload !== "object" || Array.isArray(payload) || Object.keys(payload).some((key) => key !== "revision")) return {
			ok: false,
			error: {
				details: {},
				code: "invalid-request",
				message: "Expected optional revision"
			}
		};
		const requested = payload.revision;
		if (requested !== void 0 && (typeof requested !== "number" || !Number.isSafeInteger(requested) || requested < 0)) return {
			ok: false,
			error: {
				details: {},
				code: "invalid-request",
				message: "Invalid capabilities revision"
			}
		};
		if (requested === read().revision && !lifetime.aborted && !signal.aborted) await new Promise((resolve) => {
			const finish = () => {
				clearTimeout(timer);
				unsubscribe();
				signal.removeEventListener("abort", finish);
				lifetime.removeEventListener("abort", finish);
				resolve();
			};
			const unsubscribe = registry.subscribe(finish);
			const timer = setTimeout(finish, 2e4);
			signal.addEventListener("abort", finish, { once: true });
			lifetime.addEventListener("abort", finish, { once: true });
		});
		if (lifetime.aborted || signal.aborted) return {
			ok: false,
			error: {
				details: {},
				code: "cancelled",
				message: "Capabilities subscription closed"
			}
		};
		return {
			ok: true,
			value: read()
		};
	};
}
function installCapabilitiesRpc(ctx, registry, snapshot) {
	ctx.inject(["connection"], (scope) => scope.effect(() => {
		const lifetime = new AbortController();
		const handler = capabilitiesRpc(registry, snapshot, lifetime.signal);
		const dispose = scope.connection.fetch.register({
			path: "/api/plugin-rpc/model-switch",
			methods: ["POST"],
			requestBody: "buffered",
			fetch: (request) => handleFetchRpc(request, handler, scope.connection.operator)
		});
		return async () => {
			lifetime.abort();
			await dispose();
		};
	}, "Model Switch: lifecycle-owned search capability metadata"));
}
//#endregion
//#region lib/types/deepseek-search-adapter.js
const DEFAULT_API_KEY_REF = "DEEPSEEK_API_KEY";
const SEARCH_BASE_URL_ENV = "DEEPSEEK_SEARCH_BASE_URL";
const DEEPSEEK_SEARCH_MODELS = [{
	id: DEEPSEEK_DEFAULT_MODEL,
	name: "DeepSeek-V4-Flash"
}, {
	id: "deepseek-v4-pro",
	name: "DeepSeek-V4-Pro"
}];
function readDeepSeekSection(ctx) {
	const loader = ctx.get("loader", false);
	let configured;
	for (const entry of loader?.entries() ?? []) {
		if (entry.id !== WEB_SEARCH_DEEPSEEK_SETTINGS_NAMESPACE) continue;
		configured = entry.fiber?.config;
		break;
	}
	const section = configured ?? Config$1({});
	const apiKey = section.apiKey.get();
	const baseURL = section.baseURL.get();
	return {
		...apiKey === void 0 ? {} : { apiKey },
		apiKeyEnv: section.apiKeyEnv.get(),
		...baseURL === void 0 ? {} : { baseURL },
		model: section.model.get(),
		apiVersion: section.apiVersion.get(),
		maxTokens: section.maxTokens.get(),
		maxUses: section.maxUses.get()
	};
}
function keyRef(section) {
	const name = section.apiKeyEnv ?? DEFAULT_API_KEY_REF;
	if (!isCredentialRefName(name)) throw new Error("invalid web-search-deepseek apiKeyEnv credential reference");
	return credentialRef(name);
}
function recordSearchRequest(ctx, request) {
	(ctx.get("agents")?.currentInitiator?.())?.session?.append("web/deepseek-search-llm-request", request);
}
function toProviderOptions(ctx, section, model) {
	const apiKeyEnv = keyRef(section);
	const literalApiKey = section.apiKey !== void 0 && section.apiKey.length > 0 ? section.apiKey : void 0;
	return {
		...literalApiKey === void 0 ? {} : { apiKey: literalApiKey },
		resolveApiKey: async () => {
			const credentials = ctx.get("credentials");
			if (credentials !== void 0) return (await credentials.resolve(apiKeyEnv))?.value;
			const ambient = launchEnvironmentOf(ctx).get(apiKeyEnv);
			return ambient !== void 0 && ambient.value.length > 0 ? ambient.value : void 0;
		},
		apiKeyEnv,
		baseURL: section.baseURL ?? launchEnvironmentOf(ctx).get(SEARCH_BASE_URL_ENV)?.value ?? DEEPSEEK_DEFAULT_BASE_URL,
		model,
		apiVersion: section.apiVersion ?? DEEPSEEK_DEFAULT_API_VERSION,
		maxTokens: section.maxTokens ?? DEEPSEEK_DEFAULT_MAX_TOKENS,
		maxUses: section.maxUses ?? DEEPSEEK_DEFAULT_MAX_USES,
		recordRequest: (request) => {
			recordSearchRequest(ctx, request);
		}
	};
}
var DeepSeekSearchAdapter = class {
	ctx;
	provider = DEEPSEEK_PROVIDER_ID;
	label = "DeepSeek";
	models = DEEPSEEK_SEARCH_MODELS;
	constructor(ctx) {
		this.ctx = ctx;
	}
	supportsModel(model) {
		return DEEPSEEK_SEARCH_MODELS.some((known) => known.id === model);
	}
	async search(model, request, signal) {
		if (!this.supportsModel(model)) throw new Error("search model is not supported by adapter: " + DEEPSEEK_PROVIDER_ID + "/" + model);
		const options = toProviderOptions(this.ctx, readDeepSeekSection(this.ctx), model);
		return new DeepSeekSearchProvider(() => options).search(request, signal);
	}
};
function installDeepSeekSearchAdapter(ctx) {
	ctx.inject(["modelSwitch"], (scope) => scope.effect(() => scope.modelSwitch.adapters.register({
		provider: DEEPSEEK_PROVIDER_ID,
		search: new DeepSeekSearchAdapter(ctx)
	}), "Model Switch: register DeepSeek search adapter"));
}
//#endregion
//#region lib/types/compatibility.js
/**
* Classify one runtime without treating the verified table as an allowlist.
* @param version - Resolved DSH runtime version.
* @param verified - Releases with direct compatibility evidence.
* @param blocklist - Versions excluded after reproduced failures.
* @returns The fail-open mount decision.
*/
function classifyDshRuntime(version, verified, blocklist = {}) {
	const reason = blocklist[version];
	if (typeof reason === "string" && reason.trim() !== "") return {
		kind: "blocked",
		reason
	};
	return verified.has(version) ? { kind: "verified" } : { kind: "unverified" };
}
/**
* Apply the fail-open decision and emit at most one visible warning.
* @param logger - Host logger receiving compatibility warnings.
* @param pluginName - Plugin identifier used in diagnostics.
* @param version - Resolved DSH runtime version.
* @param verified - Releases with direct compatibility evidence.
* @param blocklist - Versions excluded after reproduced failures.
* @returns Whether the host mount should continue.
*/
function shouldMountDshRuntime(logger, pluginName, version, verified, blocklist = {}) {
	const decision = classifyDshRuntime(version, verified, blocklist);
	if (decision.kind === "blocked") {
		logger.warn(`[${pluginName}] blocked on DSH ${version}: ${decision.reason}; see package.json#dsh.compatibility.blocklist`);
		return false;
	}
	if (decision.kind === "unverified") logger.warn(`[${pluginName}] best-effort on unverified runtime ${version}`);
	return true;
}
function readManifest() {
	try {
		return JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
	} catch {
		return {};
	}
}
function packageVersion(packageName) {
	try {
		const require = createRequire(import.meta.url);
		let directory = dirname(require.resolve(packageName));
		for (;;) {
			try {
				const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
				if (typeof manifest.version === "string" && manifest.version !== "") return manifest.version;
			} catch {}
			const parent = dirname(directory);
			if (parent === directory) return void 0;
			directory = parent;
		}
	} catch {
		return;
	}
}
/**
* Warn once for an unknown runtime while keeping the normal host mount path.
* @param logger - Host logger receiving compatibility warnings.
* @param pluginName - Plugin identifier used in diagnostics.
* @param candidates - DSH peer packages used to resolve the host version.
* @returns Whether the host mount should continue.
*/
function allowDshRuntime(logger, pluginName, candidates) {
	const version = process.env.DSH_VERSION?.trim() || candidates.map(packageVersion).find((value) => value !== void 0) || "unknown";
	const compatibility = readManifest().dsh?.compatibility;
	return shouldMountDshRuntime(logger, pluginName, version, new Set(Object.entries(compatibility?.dshReleases ?? {}).filter(([, status]) => status === "compatible" || status === "verified").map(([release]) => release)), compatibility?.blocklist);
}
//#endregion
//#region lib/types/switch-compact.js
/** Send-time context check and optional old-model compaction before a switched request. */
/** Fraction of the target window reserved for output plus estimator error. */
const OUTPUT_RESERVE = .2;
/** Extra tokens on top of the ratio; the meter heuristic is not exact. */
const ESTIMATE_MARGIN = 64;
/**
* Compare two fully specified model routes.
* @param left - first route, if one was resolved.
* @param right - second route, if one was resolved.
* @returns Whether both routes identify the same provider and model.
*/
function sameSwitchRoute(left, right) {
	return left !== void 0 && right !== void 0 && left.provider === right.provider && left.model === right.model;
}
/**
* Decide whether a changed, complete route needs send-time context protection.
* @param enabled - whether the user enabled send-time protection.
* @param previous - route used by the preceding request.
* @param selected - route assembled for the pending request.
* @returns Whether the pending request changes its provider or model.
*/
function shouldProtectSwitch(enabled, previous, selected) {
	if (!enabled) return false;
	if (previous === void 0 || selected === void 0) return false;
	return !sameSwitchRoute(previous, selected);
}
/**
* Input budget for the target window. Reserves output (maxTokens or 20%) plus a
* fixed estimator margin. `undefined` means the window cannot be used.
* @param contextWindow - adapter-owned combined request/response capacity.
* @param maxTokens - optional generation cap from the live agent options.
* @returns Tokens available to the request input, or undefined for an invalid window.
*/
function switchInputBudget(contextWindow, maxTokens) {
	if (!(contextWindow > 0) || !Number.isFinite(contextWindow)) return void 0;
	const reserve = Math.max(Math.ceil(contextWindow * OUTPUT_RESERVE), maxTokens ?? 0) + ESTIMATE_MARGIN;
	return Math.max(0, Math.floor(contextWindow - reserve));
}
/**
* Determine whether an estimated input exceeds its target route budget.
* @param tokens - estimated input tokens.
* @param budget - input budget for the target window.
* @returns Whether the budget is unusable or the estimate is too large.
*/
function overSwitchBudget(tokens, budget) {
	return !(budget > 0) || tokens > budget;
}
/**
* Build one transcript-visible Model Switch progress notice.
* @param text - localized notice text shown in the transcript.
* @param summary - bounded event summary for durable session metadata.
* @returns A plugin-authored user message for the session log.
*/
function switchNotice(text, summary) {
	return createUserMessage({
		content: [{
			type: "text",
			text
		}],
		source: {
			kind: "model-switch",
			form: "notice",
			summary: boundContextSummary(summary)
		}
	});
}
/**
* Extract a complete route from partial request configuration.
* @param value - candidate provider and model values.
* @returns A complete route, or undefined when either identifier is absent.
*/
function routeOf(value) {
	if (value === void 0 || value.provider === void 0 || value.provider.length === 0 || value.model === void 0 || value.model.length === 0) return void 0;
	return {
		provider: value.provider,
		model: value.model
	};
}
/**
* Install send-time switch protection on the host context.
* @param ctx - host context that owns agent-loop, llm, and tokenMeter.
* @param settings - live Model Switch settings; `compactOnSwitch !== false` is on.
* @param roleOf - provider-role lookup used to exclude native Agent runtimes.
*/
function installSwitchCompaction(ctx, settings, roleOf = () => void 0) {
	const assemblies = /* @__PURE__ */ new WeakMap();
	let stopGate;
	ctx.on("system-prompt/assemble", async (_assembly, context, next) => {
		const assembled = await next();
		if (context.agent !== void 0) {
			assemblies.set(context.agent, assembled);
			stopGate?.();
			installGate();
		}
		return assembled;
	});
	function installGate() {
		stopGate = ctx.on("agent/pre-step", async ({ agent, messages, signal }, next) => {
			const decision = await next();
			if (decision.kind !== "enter" || signal.aborted) return decision;
			const enabled = settings().compactOnSwitch !== false;
			const previous = routeOf(agent.session.requestHeader()?.config);
			const assembly = assemblies.get(agent);
			const selected = routeOf(assembly === void 0 ? void 0 : {
				...assembly.variables.provider === void 0 ? {} : { provider: assembly.variables.provider },
				...assembly.variables.model === void 0 ? {} : { model: assembly.variables.model }
			});
			if (!shouldProtectSwitch(enabled, previous, selected) || previous === void 0 || selected === void 0) return decision;
			if (roleOf(previous.provider) === "agent" || roleOf(selected.provider) === "agent") return decision;
			return protectSwitch(ctx, agent, previous, selected, assembly, decision, messages, signal);
		}, { prepend: true });
	}
}
async function protectSwitch(ctx, agent, previous, selected, assembly, decision, claimed, signal) {
	const session = agent.session;
	const notice = (text, summary) => {
		session.append("user/message", switchNotice(text, summary), { surfaceOp: "append" });
	};
	const reject = (reason, summary, compacted) => {
		notice(compacted ? `无法继续本次模型切换：压缩已发生，但请求未继续（${reason}）。` : `无法继续本次模型切换：${reason}`, summary);
		retainUserClaims(session, claimed);
		return { kind: "reject" };
	};
	notice("正在检查上下文…", "checking context");
	if (assembly === void 0) return reject("无法确定本次请求组装的目标模型。", "switch blocked: no assembled target", false);
	const llm = ctx.get("llm", false);
	if (llm?.resolveModelInfo === void 0) return reject("无法确定目标模型的上下文窗口。", "switch blocked: unknown window", false);
	let window;
	try {
		const value = (await llm.resolveModelInfo(selected.provider, selected.model, signal)).context?.contextWindow;
		window = typeof value === "number" && value > 0 ? value : void 0;
	} catch {
		window = void 0;
	}
	if (signal.aborted) return reject("已取消。", "switch blocked: cancelled", false);
	if (window === void 0) return reject("无法确定目标模型的上下文窗口。", "switch blocked: unknown window", false);
	const meter = ctx.get("tokenMeter", false);
	if (meter === void 0 || typeof meter.measure !== "function" || typeof meter.estimateMessage !== "function") return reject("无法估算待发上下文（缺少 token 计量）。", "switch blocked: no token meter", false);
	const header = targetHeader(selected, assembly);
	const previousHeader = session.requestHeader();
	let pressure;
	try {
		pressure = estimateSwitchPressure(meter, session, header, assembly, decision.messages, previousHeader);
	} catch (error) {
		return reject(`无法估算待发上下文（${error instanceof Error ? error.message : String(error)}）。`, "switch blocked: estimate failed", false);
	}
	const budget = agent.options.maxTokens === void 0 ? switchInputBudget(window) : switchInputBudget(window, agent.options.maxTokens);
	if (budget === void 0) return reject("无法确定目标模型的上下文窗口。", "switch blocked: unknown window", false);
	const passed = switchNotice("上下文容量检查通过，无需压缩。", "context check passed");
	const completed = switchNotice("压缩完成，复查通过。", "compacted");
	if (!overSwitchBudget(pressure + meter.estimateMessage(passed), budget)) {
		session.append("user/message", passed, { surfaceOp: "append" });
		return decision;
	}
	let fixedPressure;
	try {
		fixedPressure = estimateFixedInput(meter, session, header, assembly, decision.messages);
	} catch (error) {
		return reject(`无法估算待发上下文（${error instanceof Error ? error.message : String(error)}）。`, "switch blocked: estimate failed", false);
	}
	if (overSwitchBudget(fixedPressure + meter.estimateMessage(completed), budget)) return reject("新消息或固定请求内容已超过目标模型可用容量。", "switch blocked: fixed input oversized", false);
	notice("当前上下文超过目标模型可用容量，正在使用旧模型压缩…", "compacting with previous model");
	const compactionGeneration = session.surface.replaceGeneration;
	let compacted = false;
	try {
		const result = await compactWithPrevious(ctx, agent, previous, signal);
		compacted = result !== "none" || session.surface.replaceGeneration > compactionGeneration;
		if (result === "none") return reject("没有可压缩的历史。", "switch blocked: nothing to compact", compacted);
	} catch (error) {
		compacted = compacted || session.surface.replaceGeneration > compactionGeneration;
		if (signal.aborted) return reject("已取消。", "switch blocked: cancelled", compacted);
		return reject(`压缩失败（${error instanceof Error ? error.message : String(error)}）。`, "switch blocked: compact failed", compacted);
	}
	if (signal.aborted) return reject("已取消。", "switch blocked: cancelled", compacted);
	let again;
	try {
		again = estimateSwitchPressure(meter, session, header, assembly, decision.messages);
	} catch (error) {
		return reject(`压缩后无法复查（${error instanceof Error ? error.message : String(error)}）。`, "switch blocked: remeasure failed", compacted);
	}
	if (overSwitchBudget(again + meter.estimateMessage(completed), budget)) return reject("压缩后仍超过目标模型可用容量。", "switch blocked: still over budget", compacted);
	session.append("user/message", completed, { surfaceOp: "append" });
	return decision;
}
function targetHeader(selected, assembly) {
	return canonicalHeader({
		config: {
			provider: selected.provider,
			model: selected.model
		},
		...assembly.tools.length > 0 ? { tools: [...assembly.tools] } : {}
	});
}
/**
* Next-request input under the target route. Uses the committed surface priced
* for the target (including image tokens), then adds still-pending enter
* messages and the prospective system prompt while dropping already-priced
* system nodes so they are not counted twice.
*
* The target envelope has no provider usage of its own, so the meter can only
* price it with the chars-per-token heuristic. That heuristic is unconservative
* for dense text (base64 payloads, minified sources, CJK). The previous
* envelope holds the provider's reported usage for the same surface, so the
* switch takes the larger of the two prices: the anchor keeps the check
* truthful exactly where a switch makes the heuristic weakest.
*
* @param meter - replay token meter.
* @param session - session being measured.
* @param header - target request envelope.
* @param assembly - prospective prompt assembly.
* @param pending - messages the pre-step is about to enter.
* @param previousHeader - envelope of the last request, when the session has one.
* @returns Estimated next-request input tokens.
*/
function estimateSwitchPressure(meter, session, header, assembly, pending, previousHeader) {
	const estimate = routePressure(meter, session, header, assembly, pending);
	if (previousHeader === void 0) return estimate;
	return Math.max(estimate, routePressure(meter, session, previousHeader, assembly, pending));
}
/**
* Price one request envelope against the committed surface.
* @param meter - replay token meter.
* @param session - session being measured.
* @param header - request envelope to price.
* @param assembly - prospective prompt assembly.
* @param pending - messages the pre-step is about to enter.
* @returns Estimated input tokens for that envelope.
*/
function routePressure(meter, session, header, assembly, pending) {
	const measured = meter.measure(session, header);
	let systemTokens = 0;
	for (const node of measured.nodes) if (session.eventAt(node.seq)?.type === "system/message") systemTokens += node.tokens;
	return measured.totalTokens - systemTokens + systemPromptTokens(meter, assembly) + pendingTokens(meter, pending);
}
function estimateFixedInput(meter, session, header, assembly, pending) {
	const measured = meter.measure(session, header);
	return measured.totalTokens - measured.surfaceTokens + systemPromptTokens(meter, assembly) + pendingTokens(meter, pending);
}
function pendingTokens(meter, messages) {
	let total = 0;
	for (const message of messages) {
		const tokens = meter.estimateMessage(message);
		if (!(tokens >= 0) || !Number.isFinite(tokens)) throw new Error("pending message token estimate is not a number");
		total += tokens;
	}
	return total;
}
function systemPromptTokens(meter, assembly) {
	const text = renderPrompt(assembly);
	if (text.length === 0) return 0;
	return meter.estimateMessage(createMessage({
		role: "system",
		content: [{
			type: "text",
			text
		}],
		source: { kind: "system-prompt" }
	}));
}
function retainUserClaims(session, claimed) {
	for (const message of claimed) {
		if (message.source.kind !== "user") continue;
		session.append("user/message", message, { surfaceOp: "append" });
	}
}
async function compactWithPrevious(ctx, agent, previous, signal) {
	const isolated = ctx.isolate("compaction");
	const Engine = (await import("@deepseek-ai/dsh-compaction-basic")).default;
	const fiber = isolated.plugin(Engine, {
		auto: false,
		summarizationProvider: previous.provider,
		summarizationModel: previous.model,
		compactionRetries: 0
	});
	try {
		await fiber;
		const engine = isolated.get("compaction", false);
		if (engine === void 0) throw new Error("private compaction engine is unavailable");
		return await engine.compactIfNeeded(agent, "context-overflow", signal) === null ? "none" : "compacted";
	} finally {
		await fiber.dispose();
	}
}
//#endregion
//#region lib/types/host-runtime.js
/** Host owner for Model Switch settings and the released Main-default adapter. */
var ModelSwitchRuntime = class extends Service {
	static inject = ["agentDefaultModel"];
	static Config = Config;
	get capabilities() {
		const catalog = this.adapters.searchCatalog();
		return {
			...RUNTIME_CAPABILITIES,
			searchProviderAdapters: {
				available: true,
				providers: catalog.map((provider) => provider.id),
				catalog
			}
		};
	}
	adapters = new ModelSwitchAdapterRegistry();
	source;
	constructor(ctx, entry) {
		super(ctx, "modelSwitch");
		this.source = () => readConfig(entry);
		ctx.inject(["settings"], (scope) => scope.effect(() => scope.settings.configure({ auto: false }, ctx.fiber), "Model Switch: disable automatic settings form"));
		if (!allowDshRuntime(ctx.logger, "dsh-model-switch", ["@deepseek-ai/dsh-agent"])) return;
		installSwitchCompaction(ctx, () => this.source(), (provider) => this.adapters.get(provider)?.role);
		installDeepSeekSearchAdapter(ctx);
		installModelSwitchSearchProvider(ctx, this);
		installCapabilitiesRpc(ctx, this.adapters, () => this.capabilities);
		const imageTool = installGenerateImageTool(ctx, this);
		ctx.on("loader/volatile-update", () => {
			imageTool.reconcile().catch((error) => {
				ctx.logger.error("Model Switch: failed to regenerate generate_image schema");
				ctx.logger.error(error);
			});
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
const CONTEXT_SUFFIX = /-(\d+)(k|m)$/iu;
/** Peel Fast and `-<n>k` / `-<n>m` in either order. Product names like `-max` stay. */
function parsePickerId(id) {
	let rest = id;
	let fast = false;
	let contextTier = null;
	let contextTokens;
	for (;;) {
		if (rest.endsWith("-fast") && rest.length > 5) {
			rest = rest.slice(0, -5);
			fast = true;
			continue;
		}
		const match = CONTEXT_SUFFIX.exec(rest);
		if (match !== null && match.index > 0) {
			const n = Number(match[1]);
			const unit = match[2].toLowerCase();
			rest = rest.slice(0, match.index);
			contextTier = `${n}${unit}`;
			contextTokens = unit === "m" ? n * 1e6 : n * 1e3;
			continue;
		}
		break;
	}
	return {
		base: rest,
		fast,
		contextTier,
		...contextTokens === void 0 ? {} : { contextTokens }
	};
}
function memberOf(model) {
	const parsed = parsePickerId(model.id);
	return {
		model,
		fast: parsed.fast,
		contextTier: parsed.contextTier,
		...parsed.contextTokens === void 0 ? {} : { contextTokens: parsed.contextTokens },
		thinking: model.reasoning !== void 0
	};
}
/** Group directory rows by provider + peeled base. */
function groupFamilies(groups) {
	const families = [];
	const index = /* @__PURE__ */ new Map();
	for (const group of groups) for (const model of group.models) {
		const parsed = parsePickerId(model.id);
		const key = `${group.id}\0${parsed.base}`;
		let family = index.get(key);
		if (family === void 0) {
			family = {
				provider: group.id,
				providerName: group.name,
				base: parsed.base,
				name: displayNameOf(model.name, parsed),
				members: []
			};
			index.set(key, family);
			families.push(family);
		}
		family.members.push(memberOf(model));
		if (!parsed.fast && parsed.contextTier === null) family.name = displayNameOf(model.name, parsed);
	}
	return families;
}
function displayNameOf(name, parsed) {
	let next = name;
	if (parsed.fast) next = next.replace(/\s+Fast$/iu, "");
	if (parsed.contextTier !== null) next = next.replace(/\s+(?:Max|1M)$/iu, "");
	return next.replace(/\s+/gu, " ").trim() || name;
}
//#endregion
//#region lib/types/picker/plan-review.js
function planReviewOf(questions) {
	if (questions.length !== 1) return void 0;
	const question = questions[0];
	if (question === void 0) return void 0;
	const intent = question.intent;
	if (intent?.kind !== "plan-review" || question.detail === void 0 || question.multiSelect === true) return void 0;
	const options = question.options ?? [];
	if (options.length > 2) return void 0;
	const approve = options.find((option) => option.label === intent.approve);
	if (approve === void 0) return void 0;
	const decline = options.find((option) => option.label !== intent.approve);
	return {
		id: question.id,
		question: question.question,
		plan: question.detail,
		approve,
		...decline === void 0 ? {} : { decline }
	};
}
function selectPlanReview(owner) {
	const interaction = owner.pendingInteraction;
	if (interaction === void 0 || interaction.kind !== "question" && interaction.kind !== "plan-review") return null;
	return planReviewOf(interaction.questions) === void 0 ? null : interaction;
}
async function approvePlanReview(args) {
	const current = args.current;
	if (!(current !== void 0 && current !== null && current.provider === args.selection.provider && current.model === args.selection.model && current.reasoningEffort === args.selection.reasoningEffort) && !await args.select(args.selection)) return false;
	await args.answer();
	return true;
}
//#endregion
//#region lib/types/index.js
const name = "dsh-model-switch";
//#endregion
export { Config, ModelSwitchAdapterRegistry, ModelSwitchRuntime, ModelSwitchRuntime as default, RUNTIME_CAPABILITIES, approvePlanReview, groupFamilies, mainDefaultPort, name, parsePickerId, planReviewOf, readConfig, selectPlanReview };
