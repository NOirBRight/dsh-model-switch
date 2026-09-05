window.__ModuleLoader__.load({
	id: "dsh-model-switch",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react_dom = require("react-dom");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		//#region src/client-contract.ts
		const MODEL_SWITCH_SETTINGS_ID = "model-switch";
		const MAIN_SETTINGS_ID = "agent-default-model";
		var MainSettingsConflictError = class extends Error {
			name = "MainSettingsConflictError";
		};
		const SUBAGENT_SETTINGS_FIELDS = Object.freeze({
			mode: "subagentMode",
			provider: "subagentProvider",
			model: "subagentModel",
			effort: "subagentReasoningEffort"
		});
		const SEARCH_SETTINGS_FIELDS = Object.freeze({
			provider: "searchProvider",
			model: "searchModel"
		});
		const IMAGE_SETTINGS_FIELDS = Object.freeze({
			provider: "imageProvider",
			model: "imageModel"
		});
		function record$2(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
		}
		function optionalString(value) {
			return typeof value === "string" ? value : void 0;
		}
		function decodeMainSettings(value) {
			const item = record$2(value);
			if (item === void 0 || typeof item.provider !== "string" || typeof item.model !== "string") return void 0;
			const effort = optionalString(item.reasoningEffort);
			return {
				provider: item.provider,
				model: item.model,
				...effort === void 0 ? {} : { reasoningEffort: effort }
			};
		}
		function decodeModelSwitchSettings(value) {
			const item = record$2(value);
			if (item === void 0 || item.subagentMode !== "follow-main" && item.subagentMode !== "fixed") return void 0;
			return {
				subagentMode: item.subagentMode,
				...Object.fromEntries([
					"subagentProvider",
					"subagentModel",
					"subagentReasoningEffort",
					"searchProvider",
					"searchModel",
					"imageProvider",
					"imageModel"
				].flatMap((key) => {
					const field = optionalString(item[key]);
					return field === void 0 ? [] : [[key, field]];
				}))
			};
		}
		function deriveSubagentSettings(settings) {
			return {
				mode: settings.subagentMode,
				...settings.subagentProvider === void 0 ? {} : { provider: settings.subagentProvider },
				...settings.subagentModel === void 0 ? {} : { model: settings.subagentModel },
				...settings.subagentReasoningEffort === void 0 ? {} : { reasoningEffort: settings.subagentReasoningEffort }
			};
		}
		function deriveSearchSettings(settings) {
			return {
				...settings.searchProvider === void 0 ? {} : { provider: settings.searchProvider },
				...settings.searchModel === void 0 ? {} : { model: settings.searchModel }
			};
		}
		function deriveImageSettings(settings) {
			return {
				...settings.imageProvider === void 0 ? {} : { provider: settings.imageProvider },
				...settings.imageModel === void 0 ? {} : { model: settings.imageModel }
			};
		}
		//#endregion
		//#region src/client/derived-settings-scope.ts
		/** Projection over one shared SettingsScope controller/store, with explicit view-to-owner field mapping. */
		function deriveSettingsScope(source, project, fields = {}) {
			let previousSource;
			let previousView;
			const getSnapshot = () => {
				const snapshot = source.getSnapshot();
				if (snapshot === previousSource && previousView !== void 0) return previousView;
				previousSource = snapshot;
				previousView = {
					...snapshot,
					value: snapshot.value === void 0 ? void 0 : project(snapshot.value)
				};
				return previousView;
			};
			const ownerField = (field) => fields[field] ?? field;
			const mapOperations = (ops) => ops.map((operation) => ({
				...operation,
				path: operation.path.map((part, index) => index === 0 ? ownerField(part) : part)
			}));
			return {
				getSnapshot,
				subscribe: (listener) => source.subscribe(listener),
				mutate: (ops, expectedRevision) => source.mutate(mapOperations(ops), expectedRevision),
				set: (field, value) => source.set(ownerField(field), value),
				unset: (field) => source.unset(ownerField(field))
			};
		}
		//#endregion
		//#region src/client/remote-settings-scope.ts
		/** Host-backed settings scope used by this plugin on authenticated remote browsers. */
		var RemoteSettingsScope = class {
			api;
			namespace;
			decode;
			snapshot = {
				status: "loading",
				value: void 0,
				base: void 0,
				user: void 0,
				revision: void 0,
				writable: false,
				mode: "host"
			};
			listeners = /* @__PURE__ */ new Set();
			constructor(api, namespace, decode) {
				this.api = api;
				this.namespace = namespace;
				this.decode = decode;
			}
			getSnapshot = () => this.snapshot;
			subscribe = (listener) => {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			};
			async reload() {
				try {
					const result = await this.api.describe();
					if (!result.ok || result.value === void 0) throw new Error(result.error?.message ?? "settings unavailable");
					const view = result.value.namespaces.find((item) => item.ns === this.namespace);
					if (view === void 0) throw new Error("settings namespace unavailable");
					const value = this.decode(view.value);
					if (value === void 0) throw new Error("settings namespace is invalid");
					this.accept(view, value, result.value.writable);
				} catch {
					this.snapshot = {
						...this.snapshot,
						status: "unavailable",
						writable: false
					};
					this.publish();
				}
			}
			set(field, value) {
				return this.write([{
					op: "set",
					path: [field],
					value
				}]);
			}
			unset(field) {
				return this.write([{
					op: "unset",
					path: [field]
				}]);
			}
			mutate(ops, expectedRevision) {
				return this.write(ops, expectedRevision);
			}
			async write(ops, expectedRevision = this.snapshot.revision) {
				const result = await this.api.mutate(this.namespace, ops, expectedRevision);
				if (!result.ok || result.value === void 0) throw new Error((result.error?.code ?? "settings-error") + ": " + (result.error?.message ?? ""));
				const value = this.decode(result.value.value);
				if (value === void 0) throw new Error("settings namespace is invalid");
				this.accept(result.value, value, this.snapshot.writable);
			}
			accept(view, value, writable) {
				this.snapshot = {
					status: "ready",
					value,
					base: view.base,
					user: view.user,
					revision: view.revision,
					writable,
					mode: "host"
				};
				this.publish();
			}
			publish() {
				for (const listener of this.listeners) listener();
			}
		};
		//#endregion
		//#region src/runtime-capabilities.ts
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
		//#region src/client/search-capabilities.ts
		function record$1(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
		}
		function cleanId(value) {
			return typeof value === "string" && value.trim() !== "" ? value : void 0;
		}
		function decodeModel(value) {
			const item = record$1(value);
			const id = item === void 0 ? void 0 : cleanId(item.id);
			const name = item === void 0 ? void 0 : cleanId(item.name);
			return id === void 0 || name === void 0 ? void 0 : {
				id,
				name
			};
		}
		/**
		* Strictly decode the Host search catalog into fresh plain metadata. Any malformed
		* entry fails the whole catalog (undefined): when the Host claims search is
		* available, invalid config must surface as an error, never hide as dropped rows.
		* Extra fields (functions, credentials) never survive: only id/name copy over.
		*/
		function decodeSearchCatalog(value) {
			if (!Array.isArray(value)) return void 0;
			const providers = [];
			for (const item of value) {
				const entry = record$1(item);
				const id = entry === void 0 ? void 0 : cleanId(entry.id);
				const name = entry === void 0 ? void 0 : cleanId(entry.name);
				if (entry === void 0 || id === void 0 || name === void 0 || !Array.isArray(entry.models)) return void 0;
				const models = [];
				for (const model of entry.models) {
					const decoded = decodeModel(model);
					if (decoded === void 0) return void 0;
					models.push(decoded);
				}
				providers.push({
					id,
					name,
					models
				});
			}
			return providers;
		}
		/**
		* Strictly decode one capabilities long-poll value; undefined when untrusted.
		* Only the decoded search block is taken from the network and overlaid onto the
		* frozen local defaults: no arbitrary Host fields pass through.
		*/
		function decodeCapabilitiesSnapshot(value) {
			const payload = record$1(value);
			const revision = payload?.revision;
			if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0) return void 0;
			const capabilities = payload?.capabilities === void 0 ? void 0 : record$1(payload.capabilities);
			if (capabilities === void 0) return void 0;
			const search = record$1(capabilities.searchProviderAdapters);
			if (search === void 0 || typeof search.available !== "boolean") return void 0;
			if (search.providers !== void 0 && (!Array.isArray(search.providers) || !search.providers.every((id) => typeof id === "string"))) return void 0;
			const catalog = search.catalog === void 0 ? [] : decodeSearchCatalog(search.catalog);
			if (catalog === void 0) return void 0;
			return {
				revision,
				capabilities: {
					...RUNTIME_CAPABILITIES,
					searchProviderAdapters: {
						available: search.available,
						providers: search.providers ?? [],
						catalog
					}
				}
			};
		}
		/** Project already-validated Host search metadata onto group shape (no re-decode). */
		function searchGroupsFromCapabilities(capabilities) {
			const catalog = capabilities?.searchProviderAdapters.catalog;
			if (catalog === void 0) return [];
			return catalog.map((provider) => ({
				id: provider.id,
				name: provider.name,
				models: provider.models.map((model) => ({
					id: model.id,
					name: model.name
				}))
			}));
		}
		//#endregion
		//#region src/client/picker/external-catalog.ts
		/** Overlay groups from External Agent catalog onto the LLM session.models snapshot. */
		function mergePickerGroups(base, extra) {
			if (extra.length === 0) return base;
			const ids = new Set(extra.map((group) => group.id));
			return [...base.filter((group) => !ids.has(group.id)), ...extra];
		}
		//#endregion
		//#region src/client/antigravity-catalog.ts
		/** Provider key owned by the Antigravity card. */
		const ANTIGRAVITY_PROVIDER_KEY = "antigravity";
		/** Agent role owned by ProviderDirectory (dsh-llm-providers-ui), never hardcoded by Model Switch. */
		const AGENT_ROLE = "agent";
		/**
		* Released Antigravity settings RPC seam (dsh-acp-antigravity client-contract).
		* Kept as literals: the Antigravity plugin is not a Model Switch dependency.
		*/
		const ANTIGRAVITY_CATALOG_CHANNEL = "/dsh-acp-antigravity";
		const ANTIGRAVITY_CATALOG_ENDPOINT = "catalog";
		function record(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
		}
		/** Strictly decode one Enabled-catalog group; malformed groups are dropped, never thrown. */
		function decodeGroup(value) {
			const group = record(value);
			if (group === void 0 || typeof group.id !== "string" || typeof group.name !== "string" || !Array.isArray(group.models)) return void 0;
			const models = [];
			for (const item of group.models) {
				const model = record(item);
				if (model === void 0 || typeof model.id !== "string" || typeof model.name !== "string") continue;
				models.push({
					id: model.id,
					name: model.name
				});
			}
			if (models.length === 0) return void 0;
			return {
				id: group.id,
				name: group.name,
				models
			};
		}
		/** Decode the Enabled-catalog payload; anything malformed decodes to no groups. */
		function decodeAntigravityCatalogGroups(value) {
			const payload = record(value);
			if (payload === void 0 || !Array.isArray(payload.groups)) return [];
			const groups = [];
			for (const item of payload.groups) {
				const group = decodeGroup(item);
				if (group !== void 0) groups.push(group);
			}
			return groups;
		}
		/**
		* Read the Enabled catalog; resolves to no groups when Antigravity is absent,
		* unreachable, or malformed. Never throws: the Host catalog stays authoritative.
		*/
		async function fetchAntigravityCatalogGroups(rpc) {
			if (rpc === void 0) return [];
			try {
				const result = await rpc.call(ANTIGRAVITY_CATALOG_CHANNEL, ANTIGRAVITY_CATALOG_ENDPOINT, {}, void 0);
				return result.ok ? decodeAntigravityCatalogGroups(result.value) : [];
			} catch {
				return [];
			}
		}
		/** Overlay Enabled-catalog groups onto the Host catalog without duplicating ids. */
		function withAntigravityCatalog(base, extra) {
			return mergePickerGroups(base, extra);
		}
		/** Read one Provider role from the owner directory; undefined when the seam is absent. */
		function readProviderRole(directory, key) {
			if (directory === null || typeof directory !== "object" && typeof directory !== "function") return void 0;
			const roleOf = directory.roleOf;
			if (typeof roleOf !== "function") return void 0;
			const role = roleOf.call(directory, key);
			return typeof role === "string" ? role : void 0;
		}
		/** Whether a ProviderDirectory-owned role marks an Agent provider. */
		function isAgentRole(role) {
			return role === AGENT_ROLE;
		}
		//#endregion
		//#region src/client/main-row-controller.ts
		/** Build a settings route for a newly selected model using only that model's default effort. */
		function selectRouteModel(groups, provider, model) {
			const defaultEffort = groups.find((group) => group.id === provider)?.models.find((item) => item.id === model)?.reasoning?.defaultEffort;
			return {
				provider,
				model,
				...defaultEffort === void 0 ? {} : { reasoningEffort: defaultEffort }
			};
		}
		function deriveRouteChoices(groups, route, allowedProviders) {
			const allowed = allowedProviders === void 0 ? void 0 : new Set(allowedProviders);
			const providers = groups.filter((group) => allowed === void 0 || allowed.has(group.id)).map((group) => ({
				id: group.id,
				name: group.name
			}));
			if (route?.provider !== void 0 && !providers.some((option) => option.id === route.provider)) providers.push({
				id: route.provider,
				name: route.provider,
				unavailable: true
			});
			const models = (groups.find((item) => item.id === route?.provider)?.models ?? []).map((model) => ({
				id: model.id,
				name: model.name
			}));
			if (route?.model !== void 0 && !models.some((option) => option.id === route.model)) models.push({
				id: route.model,
				name: route.model,
				unavailable: true
			});
			return {
				providers,
				models
			};
		}
		function expectedMainRevision(mirror, accepted) {
			return Math.max(mirror, accepted ?? mirror);
		}
		function acceptedRevisionAfterFailure(accepted, error) {
			return error instanceof MainSettingsConflictError ? void 0 : accepted;
		}
		function deriveMainChoices(groups, draft) {
			const providers = groups.map((group) => ({
				id: group.id,
				name: group.name
			}));
			if (draft !== void 0 && !providers.some((option) => option.id === draft.provider)) providers.push({
				id: draft.provider,
				name: draft.provider
			});
			const group = groups.find((item) => item.id === draft?.provider);
			const models = (group?.models ?? []).map((model) => ({
				id: model.id,
				name: model.name
			}));
			if (draft !== void 0 && !models.some((option) => option.id === draft.model)) models.push({
				id: draft.model,
				name: draft.model
			});
			const efforts = ((group?.models.find((item) => item.id === draft?.model))?.reasoning?.efforts ?? []).map((effort) => ({
				id: effort.id,
				name: effort.name
			}));
			if (draft?.reasoningEffort !== void 0 && !efforts.some((option) => option.id === draft.reasoningEffort)) efforts.push({
				id: draft.reasoningEffort,
				name: draft.reasoningEffort
			});
			return {
				providers,
				models,
				efforts
			};
		}
		function useModelSwitchSettingsController(input) {
			const main = input.useMainSettings((value) => value);
			const subagent = input.useSubagentSettings((value) => value);
			const [draft, setDraft] = (0, react.useState)(main.value);
			const [groups, setGroups] = (0, react.useState)([]);
			const [busy, setBusy] = (0, react.useState)(false);
			const [message, setMessage] = (0, react.useState)();
			const locked = (0, react.useRef)(false);
			const acceptedRevision = (0, react.useRef)();
			(0, react.useEffect)(() => {
				setDraft(main.value);
				setMessage(void 0);
				if (main.revision !== void 0 && (acceptedRevision.current === void 0 || main.revision > acceptedRevision.current)) acceptedRevision.current = main.revision;
			}, [main.revision, main.value]);
			(0, react.useEffect)(() => {
				let live = true;
				const load = () => {
					input.loadCatalog().then((value) => {
						if (live) setGroups(value);
					}).catch(() => {
						if (live) setMessage(input.t("catalogFailed"));
					});
				};
				load();
				const stop = input.subscribeProviderOrder?.(() => {
					if (live) load();
				});
				return () => {
					live = false;
					stop?.();
				};
			}, [
				input.loadCatalog,
				input.subscribeProviderOrder,
				input.t
			]);
			const { providers, models, efforts } = deriveMainChoices(groups, draft);
			const disabled = main.status !== "ready" || !main.writable || draft === void 0 || busy || draft.provider.trim() === "" || draft.model.trim() === "";
			const setProvider = (provider) => setDraft((current) => {
				if (current === void 0) return current;
				const first = groups.find((item) => item.id === provider)?.models[0];
				return selectRouteModel(groups, provider, first?.id ?? current.model);
			});
			const setModel = (id) => setDraft((current) => current === void 0 ? current : selectRouteModel(groups, current.provider, id));
			const setReasoningEffort = (value) => setDraft((current) => {
				if (current === void 0) return current;
				const next = { ...current };
				if (value === "") delete next.reasoningEffort;
				else next.reasoningEffort = value;
				return next;
			});
			const reset = () => {
				setDraft(main.value);
				setMessage(void 0);
			};
			const save = async () => {
				if (disabled || locked.current || draft === void 0) return;
				const mirrorRevision = main.revision;
				if (mirrorRevision === void 0) {
					setMessage(input.t("requestFailed"));
					return;
				}
				const expectedRevision = expectedMainRevision(mirrorRevision, acceptedRevision.current);
				locked.current = true;
				setBusy(true);
				setMessage(void 0);
				try {
					acceptedRevision.current = await input.saveMain(draft, expectedRevision);
					setMessage(input.t("saved"));
				} catch (error) {
					acceptedRevision.current = acceptedRevisionAfterFailure(acceptedRevision.current, error);
					setMessage(error instanceof Error ? error.message : input.t("requestFailed"));
				} finally {
					locked.current = false;
					setBusy(false);
				}
			};
			return {
				main,
				subagent,
				draft,
				groups,
				providers,
				models,
				efforts,
				busy,
				message,
				disabled,
				setProvider,
				setModel,
				setReasoningEffort,
				reset,
				save
			};
		}
		//#endregion
		//#region \0dsh-css:src/client/ModelSwitchSettings.module.css.mjs
		const css$2 = ".djvrPG_section{max-width:720px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:12px;display:flex;container-type:inline-size}.djvrPG_title{margin:0;font-size:16px;font-weight:500;line-height:24px}.djvrPG_intro{color:var(--dsw-alias-label-tertiary);margin:0;font-size:14px;line-height:22px}.djvrPG_saved{color:var(--dsw-alias-state-success-primary);align-items:center;gap:6px;margin:0;font-size:12px;line-height:18px;display:flex}.djvrPG_savedDot{background:currentColor;border-radius:50%;width:7px;height:7px}.djvrPG_group{flex-direction:column;gap:8px;margin-top:8px;display:flex}.djvrPG_groupLabel{color:var(--dsw-alias-label-tertiary);margin:0 2px;font-size:12px;font-weight:500;line-height:18px}.djvrPG_routeCard{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-module-platform);border-radius:10px;list-style:none;overflow:hidden}.djvrPG_routeCardUnavailable{opacity:.72}.djvrPG_routeHeader{width:100%;min-height:68px;color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;justify-content:space-between;align-items:center;gap:16px;padding:12px 14px;display:flex}.djvrPG_routeHeader:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.djvrPG_routeHeader:disabled{cursor:default}.djvrPG_routeIcon{width:18px;height:18px;color:var(--dsw-alias-label-primary);flex:none;display:block}.djvrPG_routeCopy{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.djvrPG_routeName{color:var(--dsw-alias-label-primary);align-items:center;gap:8px;font-size:14px;font-weight:600;line-height:20px;display:flex}.djvrPG_routeSummary{color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;font-size:13px;line-height:18px;overflow:hidden}.djvrPG_badge{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;flex:none;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.djvrPG_badgeWarn{color:var(--dsw-alias-state-warn-label)}.djvrPG_chevron{width:18px;height:18px;color:var(--dsw-alias-label-primary);flex:none;transition:transform .16s}.djvrPG_routeCardOpen .djvrPG_chevron{transform:rotate(180deg)}.djvrPG_cardBody{border-top:1px solid var(--dsw-alias-border-l2);padding:16px 14px 18px}.djvrPG_formGrid{grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;display:grid}.djvrPG_field{flex-direction:column;gap:6px;min-width:0;display:flex}.djvrPG_fieldFull{grid-column:1/-1}.djvrPG_fieldLabel{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500;line-height:18px}.djvrPG_input{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);appearance:none;background-color:var(--dsw-alias-bg-layer-1);width:100%;height:32px;color:var(--dsw-alias-label-primary);font:inherit;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2381858C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\");background-position:right 10px center;background-repeat:no-repeat;border-radius:8px;padding:0 32px 0 10px;font-size:14px;line-height:22px}.djvrPG_textInput{background-image:none;padding-right:10px}.djvrPG_input:focus{border-color:var(--dsw-alias-brand-primary);outline:none}.djvrPG_input:disabled{opacity:.6;cursor:default}.djvrPG_hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:18px}.djvrPG_warning{color:var(--dsw-alias-state-warn-label)}.djvrPG_message{flex:1;min-width:0}.djvrPG_cardFooter{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;margin-top:14px;padding:12px 0 0;display:flex}.djvrPG_button{box-sizing:border-box;height:36px;font:inherit;cursor:pointer;border-radius:18px;justify-content:center;align-items:center;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex}.djvrPG_secondaryButton{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);background:0 0}.djvrPG_secondaryButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid)}.djvrPG_primaryButton{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);border:0}.djvrPG_primaryButton:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}.djvrPG_button:disabled{opacity:.4;cursor:default}.djvrPG_button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}@container (width<=420px){.djvrPG_formGrid{grid-template-columns:1fr}.djvrPG_cardFooter .djvrPG_button{flex:1}}@media (prefers-reduced-motion:reduce){.djvrPG_chevron{transition:none}}";
		const tagId$2 = "dsh-model-switch/ModelSwitchSettings.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-model-switch";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var ModelSwitchSettings_module_css_default = {
			"badge": "djvrPG_badge",
			"badgeWarn": "djvrPG_badgeWarn",
			"button": "djvrPG_button",
			"cardBody": "djvrPG_cardBody",
			"cardFooter": "djvrPG_cardFooter",
			"chevron": "djvrPG_chevron",
			"field": "djvrPG_field",
			"fieldFull": "djvrPG_fieldFull",
			"fieldLabel": "djvrPG_fieldLabel",
			"formGrid": "djvrPG_formGrid",
			"group": "djvrPG_group",
			"groupLabel": "djvrPG_groupLabel",
			"hint": "djvrPG_hint",
			"input": "djvrPG_input",
			"intro": "djvrPG_intro",
			"message": "djvrPG_message",
			"primaryButton": "djvrPG_primaryButton",
			"routeCard": "djvrPG_routeCard",
			"routeCardOpen": "djvrPG_routeCardOpen",
			"routeCardUnavailable": "djvrPG_routeCardUnavailable",
			"routeCopy": "djvrPG_routeCopy",
			"routeHeader": "djvrPG_routeHeader",
			"routeIcon": "djvrPG_routeIcon",
			"routeName": "djvrPG_routeName",
			"routeSummary": "djvrPG_routeSummary",
			"saved": "djvrPG_saved",
			"savedDot": "djvrPG_savedDot",
			"secondaryButton": "djvrPG_secondaryButton",
			"section": "djvrPG_section",
			"textInput": "djvrPG_textInput",
			"title": "djvrPG_title",
			"warning": "djvrPG_warning"
		};
		//#endregion
		//#region src/client/ModelSwitchSettings.tsx
		function cx(...values) {
			return values.filter(Boolean).join(" ");
		}
		function compact(...values) {
			return values.filter((value) => value !== void 0 && value !== "").join(" · ");
		}
		function RouteIcon({ kind }) {
			if (kind === "main") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: "18",
				height: "18",
				viewBox: "0 0 18 18",
				fill: "none",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M3 4.5h12v8H8l-3.5 2v-2H3v-8Z",
					stroke: "currentColor",
					strokeLinejoin: "round"
				})
			});
			if (kind === "subagent") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: "18",
				height: "18",
				viewBox: "0 0 18 18",
				fill: "none",
				"aria-hidden": "true",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "6",
						cy: "6",
						r: "2.5",
						stroke: "currentColor"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "12.5",
						cy: "11.5",
						r: "2",
						stroke: "currentColor"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M3 14c.4-2.5 1.6-4 3-4s2.6 1.5 3 4M10 7.5c.5-.8 1.3-1.2 2.2-1.2 1.5 0 2.6 1 2.8 2.7",
						stroke: "currentColor",
						strokeLinecap: "round"
					})
				]
			});
			if (kind === "search") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: "18",
				height: "18",
				viewBox: "0 0 18 18",
				fill: "none",
				"aria-hidden": "true",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					cx: "8",
					cy: "8",
					r: "4.5",
					stroke: "currentColor"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "m11.5 11.5 3.5 3.5",
					stroke: "currentColor",
					strokeLinecap: "round"
				})]
			});
			if (kind === "image") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: "18",
				height: "18",
				viewBox: "0 0 18 18",
				fill: "none",
				"aria-hidden": "true",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "2.5",
						y: "3",
						width: "13",
						height: "12",
						rx: "2",
						stroke: "currentColor"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "6.5",
						cy: "7",
						r: "1.3",
						stroke: "currentColor"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "m4 13 3.5-3 2.2 2 1.8-1.6 2.5 2.6",
						stroke: "currentColor",
						strokeLinejoin: "round"
					})
				]
			});
			return null;
		}
		function RouteCard({ title, summary, icon, open, onToggle, disabled = false, badge, badgeWarn = false, children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
				className: cx(ModelSwitchSettings_module_css_default.routeCard, open && ModelSwitchSettings_module_css_default.routeCardOpen, disabled && ModelSwitchSettings_module_css_default.routeCardUnavailable),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: ModelSwitchSettings_module_css_default.routeHeader,
					disabled,
					"aria-expanded": disabled ? void 0 : open,
					onClick: onToggle,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: ModelSwitchSettings_module_css_default.routeIcon,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RouteIcon, { kind: icon })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: ModelSwitchSettings_module_css_default.routeCopy,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: ModelSwitchSettings_module_css_default.routeName,
								children: [title, badge === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {
									className: cx(ModelSwitchSettings_module_css_default.badge, badgeWarn && ModelSwitchSettings_module_css_default.badgeWarn),
									children: badge
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ModelSwitchSettings_module_css_default.routeSummary,
								children: summary
							})]
						}),
						disabled ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
							className: ModelSwitchSettings_module_css_default.chevron,
							width: "14",
							height: "14",
							viewBox: "0 0 14 14",
							fill: "none",
							"aria-hidden": "true",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
								d: "m4 5 3 3 3-3",
								stroke: "currentColor",
								strokeLinecap: "round",
								strokeLinejoin: "round"
							})
						})
					]
				}), open && !disabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: ModelSwitchSettings_module_css_default.cardBody,
					children
				}) : null]
			});
		}
		function Field({ label, value, disabled, choices, onChange, full = false }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: cx(ModelSwitchSettings_module_css_default.field, full && ModelSwitchSettings_module_css_default.fieldFull),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: ModelSwitchSettings_module_css_default.fieldLabel,
					children: label
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
					className: ModelSwitchSettings_module_css_default.input,
					disabled,
					value: value ?? "",
					onChange: (event) => {
						onChange(event.target.value);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
						value: "",
						children: "—"
					}), choices.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
						value: option.id,
						children: [option.name, option.unavailable === true ? " ⚠" : ""]
					}, option.id))]
				})]
			});
		}
		function Actions({ t, busy, disabled, message, onCancel, onSave }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: ModelSwitchSettings_module_css_default.cardFooter,
				children: [
					message === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: cx(ModelSwitchSettings_module_css_default.hint, ModelSwitchSettings_module_css_default.message),
						children: message
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: cx(ModelSwitchSettings_module_css_default.button, ModelSwitchSettings_module_css_default.secondaryButton),
						disabled: busy,
						onClick: onCancel,
						children: t("cancel")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: cx(ModelSwitchSettings_module_css_default.button, ModelSwitchSettings_module_css_default.primaryButton),
						disabled,
						onClick: onSave,
						children: busy ? t("saving") : t("save")
					})
				]
			});
		}
		function useDraft(snapshot) {
			const [draft, setDraft] = (0, react.useState)(snapshot.value);
			(0, react.useEffect)(() => {
				setDraft(snapshot.value);
			}, [snapshot.revision, snapshot.value]);
			return [
				draft,
				setDraft,
				() => {
					setDraft(snapshot.value);
				}
			];
		}
		function routeName(groups, route) {
			if (route === void 0) return "";
			const provider = groups.find((group) => group.id === route.provider);
			const model = provider?.models.find((item) => item.id === route.model);
			return compact(provider?.name ?? route.provider, model?.name ?? route.model);
		}
		function routeDefaultEffort(groups, route) {
			if (route === void 0) return void 0;
			return groups.find((group) => group.id === route.provider)?.models.find((model) => model.id === route.model)?.reasoning?.defaultEffort;
		}
		function capabilityChoices(groups, route, providers, kind) {
			const choices = deriveRouteChoices(groups, route, providers);
			if (kind === "image" && route?.provider === "grok") {
				const models = [{
					id: "grok-imagine-image-quality",
					name: "Grok Imagine 1.0"
				}];
				if (route.model !== void 0 && !models.some((model) => model.id === route.model)) models.push({
					id: route.model,
					name: route.model,
					unavailable: true
				});
				return {
					providers: choices.providers,
					models
				};
			}
			return choices;
		}
		function ModelSwitchSettings(props) {
			const controller = useModelSwitchSettingsController(props);
			const { main, subagent, draft, groups } = controller;
			const search = props.useSearchSettings((value) => value);
			const image = props.useImageSettings((value) => value);
			const [open, setOpen] = (0, react.useState)();
			const [subagentDraft, setSubagentDraft, resetSubagent] = useDraft(subagent);
			const [searchDraft, setSearchDraft, resetSearch] = useDraft(search);
			const [imageDraft, setImageDraft, resetImage] = useDraft(image);
			const [busy, setBusy] = (0, react.useState)();
			const [message, setMessage] = (0, react.useState)();
			const loadSearchCapabilities = props.loadCapabilities;
			const [searchSnapshot, setSearchSnapshot] = (0, react.useState)(void 0);
			const [searchError, setSearchError] = (0, react.useState)(void 0);
			(0, react.useEffect)(() => {
				if (loadSearchCapabilities === void 0) return;
				let live = true;
				const scope = new AbortController();
				let timer;
				let failures = 0;
				const poll = async (revision) => {
					try {
						const snapshot = await loadSearchCapabilities(revision, scope.signal);
						if (!live) return;
						failures = 0;
						setSearchSnapshot(snapshot);
						setSearchError(void 0);
						poll(snapshot.revision);
					} catch (error) {
						if (!live || scope.signal.aborted) return;
						failures = Math.min(failures + 1, 8);
						if (failures >= 3) setSearchError(error instanceof Error ? error.message : props.t("catalogFailed"));
						timer = setTimeout(() => {
							if (live) poll(void 0);
						}, Math.min(250 * 2 ** (failures - 1), 2e4));
					}
				};
				poll(void 0);
				return () => {
					live = false;
					scope.abort();
					if (timer !== void 0) clearTimeout(timer);
				};
			}, [loadSearchCapabilities]);
			const unavailable = (key) => {
				const reason = props.capabilities[key].reason;
				return reason === void 0 ? props.t("unavailable") : props.t("reason." + reason);
			};
			const toggle = (route) => {
				setOpen((current) => current === route ? void 0 : route);
				setMessage(void 0);
			};
			const subagentRoute = subagentDraft === void 0 ? void 0 : {
				...subagentDraft.provider === void 0 ? {} : { provider: subagentDraft.provider },
				...subagentDraft.model === void 0 ? {} : { model: subagentDraft.model }
			};
			const subagentChoices = deriveRouteChoices(groups, subagentRoute);
			const subagentEfforts = (() => {
				const efforts = (groups.find((item) => item.id === subagentRoute?.provider)?.models.find((item) => item.id === subagentRoute?.model)?.reasoning?.efforts ?? []).map((effort) => ({
					id: effort.id,
					name: effort.name
				}));
				if (subagentDraft?.reasoningEffort !== void 0 && !efforts.some((option) => option.id === subagentDraft.reasoningEffort)) efforts.push({
					id: subagentDraft.reasoningEffort,
					name: subagentDraft.reasoningEffort
				});
				return efforts;
			})();
			const defaultEffort = subagentDraft?.reasoningEffort ?? routeDefaultEffort(groups, subagentRoute);
			const mainEffectiveEffort = draft?.reasoningEffort ?? routeDefaultEffort(groups, draft);
			const searchLive = searchSnapshot?.capabilities;
			const searchGroups = searchGroupsFromCapabilities(searchLive);
			const searchChoices = capabilityChoices(searchGroups, searchDraft, void 0, "search");
			const searchAvailable = searchLive?.searchProviderAdapters.available ?? false;
			const imageChoices = capabilityChoices(groups, imageDraft, props.capabilities.imageProviderAdapters.providers ?? [], "image");
			const synced = [
				main,
				subagent,
				search,
				image
			].every((snapshot) => snapshot.status === "ready");
			const run = async (route, operation) => {
				if (busy !== void 0) return;
				setBusy(route);
				setMessage(void 0);
				try {
					await operation();
					setMessage({
						route,
						text: props.t("saved")
					});
				} catch (error) {
					setMessage({
						route,
						text: error instanceof Error ? error.message : props.t("requestFailed")
					});
				} finally {
					setBusy(void 0);
				}
			};
			const saveSubagent = () => {
				if (subagentDraft === void 0) return;
				run("subagent", async () => {
					if (subagent.value?.mode !== subagentDraft.mode) await props.setSubagent("mode", subagentDraft.mode);
					if (subagentDraft.mode === "fixed") {
						if (subagent.value?.provider !== subagentDraft.provider) await props.setSubagent("provider", subagentDraft.provider);
						if (subagent.value?.model !== subagentDraft.model) await props.setSubagent("model", subagentDraft.model);
						const nextEffort = subagentDraft.reasoningEffort === "" ? void 0 : subagentDraft.reasoningEffort;
						if (subagent.value?.reasoningEffort !== nextEffort) await props.setSubagent("effort", nextEffort);
					}
				});
			};
			const saveCapability = (route, current, next) => {
				if (next === void 0) return;
				run(route, async () => {
					if (current.value?.provider !== next.provider) await props.setCapability(route, "provider", next.provider);
					if (current.value?.model !== next.model) await props.setCapability(route, "model", next.model);
				});
			};
			const mainSummary = draft === void 0 ? props.t("loading") : compact(routeName(groups, draft), mainEffectiveEffort);
			const subagentRole = subagentDraft?.mode === "fixed" && subagentDraft.provider !== void 0 && subagentDraft.provider !== "" ? props.providerRoleOf?.(subagentDraft.provider) : void 0;
			const subagentSummary = subagentDraft?.mode === "follow-main" ? props.t("subagentFollowMain") : compact(props.t("subagentFixed"), routeName(groups, subagentRoute), isAgentRole(subagentRole) ? props.t("agentBadge") : void 0, defaultEffort === void 0 ? props.t("providerDefaultShort") : compact(props.t("providerDefaultShort"), defaultEffort));
			const subagentDisabled = subagent.status !== "ready" || !subagent.writable || subagentDraft === void 0 || busy === "subagent" || subagentDraft.mode === "fixed" && ((subagentDraft.provider ?? "").trim() === "" || (subagentDraft.model ?? "").trim() === "");
			const capabilityDisabled = (route, snapshot, next) => snapshot.status !== "ready" || !snapshot.writable || next === void 0 || busy === route || (next.provider ?? "").trim() === "" || (next.model ?? "").trim() === "";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("main", {
				className: ModelSwitchSettings_module_css_default.section,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", {
						className: ModelSwitchSettings_module_css_default.title,
						children: props.t("title")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ModelSwitchSettings_module_css_default.intro,
						children: props.t("subtitle")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: ModelSwitchSettings_module_css_default.saved,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", { className: ModelSwitchSettings_module_css_default.savedDot }), synced ? props.t("settingsSynced") : props.t("loading")]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: ModelSwitchSettings_module_css_default.group,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
								className: ModelSwitchSettings_module_css_default.groupLabel,
								children: props.t("conversationRoutes")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RouteCard, {
								title: props.t("main"),
								summary: mainSummary,
								icon: "main",
								open: open === "main",
								onToggle: () => {
									toggle("main");
								},
								badge: props.t("defaultBadge"),
								children: draft === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: ModelSwitchSettings_module_css_default.hint,
									children: props.t("loading")
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: ModelSwitchSettings_module_css_default.formGrid,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
												label: props.t("provider"),
												value: draft.provider,
												disabled: controller.busy || !main.writable,
												choices: controller.providers,
												onChange: controller.setProvider
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
												label: props.t("model"),
												value: draft.model,
												disabled: controller.busy || !main.writable,
												choices: controller.models,
												onChange: controller.setModel
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
												label: props.t("effort"),
												value: draft.reasoningEffort ?? "",
												disabled: controller.busy || !main.writable,
												choices: controller.efforts,
												onChange: controller.setReasoningEffort
											})
										]
									}),
									!main.writable && main.status === "ready" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: ModelSwitchSettings_module_css_default.hint,
										children: props.t("readonly")
									}) : null,
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Actions, {
										t: props.t,
										busy: controller.busy,
										disabled: controller.disabled,
										...controller.message === void 0 ? {} : { message: controller.message },
										onCancel: controller.reset,
										onSave: () => {
											controller.save();
										}
									})
								] })
							}),
							props.capabilities.centralSubagentRouting.available ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RouteCard, {
								title: props.t("subagent"),
								summary: subagentSummary,
								icon: "subagent",
								open: open === "subagent",
								onToggle: () => {
									toggle("subagent");
								},
								children: subagentDraft === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: ModelSwitchSettings_module_css_default.hint,
									children: props.t("loading")
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: ModelSwitchSettings_module_css_default.formGrid,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: cx(ModelSwitchSettings_module_css_default.field, ModelSwitchSettings_module_css_default.fieldFull),
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: ModelSwitchSettings_module_css_default.fieldLabel,
											children: props.t("subagentMode")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
											className: ModelSwitchSettings_module_css_default.input,
											disabled: busy === "subagent" || !subagent.writable,
											value: subagentDraft.mode,
											onChange: (event) => {
												setSubagentDraft({
													...subagentDraft,
													mode: event.target.value
												});
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "fixed",
												children: props.t("subagentFixed")
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
												value: "follow-main",
												children: props.t("subagentFollowMain")
											})]
										})]
									}), subagentDraft.mode === "fixed" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
											label: props.t("provider"),
											value: subagentDraft.provider ?? "",
											disabled: busy === "subagent" || !subagent.writable,
											choices: subagentChoices.providers,
											onChange: (provider) => {
												const first = groups.find((group) => group.id === provider)?.models[0];
												setSubagentDraft({
													mode: subagentDraft.mode,
													...selectRouteModel(groups, provider, first?.id ?? subagentDraft.model ?? "")
												});
											}
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
											label: props.t("model"),
											value: subagentDraft.model ?? "",
											disabled: busy === "subagent" || !subagent.writable,
											choices: subagentChoices.models,
											onChange: (model) => {
												setSubagentDraft({
													mode: subagentDraft.mode,
													...selectRouteModel(groups, subagentDraft.provider ?? "", model)
												});
											}
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
											label: props.t("effort"),
											value: subagentDraft.reasoningEffort ?? "",
											disabled: busy === "subagent" || !subagent.writable,
											choices: subagentEfforts,
											onChange: (effort) => {
												setSubagentDraft({
													...subagentDraft,
													reasoningEffort: effort
												});
											}
										})
									] }) : null]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Actions, {
									t: props.t,
									busy: busy === "subagent",
									disabled: subagentDisabled,
									...message?.route === "subagent" ? { message: message.text } : {},
									onCancel: () => {
										resetSubagent();
										setMessage(void 0);
									},
									onSave: saveSubagent
								})] })
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RouteCard, {
								title: props.t("subagent"),
								summary: unavailable("centralSubagentRouting"),
								icon: "subagent",
								open: false,
								onToggle: () => {},
								disabled: true,
								badge: props.t("unavailable"),
								badgeWarn: true
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: ModelSwitchSettings_module_css_default.group,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
								className: ModelSwitchSettings_module_css_default.groupLabel,
								children: props.t("capabilityRoutes")
							}),
							searchAvailable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RouteCard, {
								title: props.t("search"),
								summary: searchDraft === void 0 ? props.t("loading") : routeName(searchGroups, searchDraft),
								icon: "search",
								open: open === "search",
								onToggle: () => {
									toggle("search");
								},
								children: searchDraft === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: ModelSwitchSettings_module_css_default.hint,
									children: props.t("loading")
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: ModelSwitchSettings_module_css_default.hint,
										children: props.t("searchHelp")
									}),
									searchError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: ModelSwitchSettings_module_css_default.hint,
										children: searchError
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: ModelSwitchSettings_module_css_default.formGrid,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
											label: props.t("provider"),
											value: searchDraft.provider,
											disabled: busy === "search" || !search.writable || searchError !== void 0,
											choices: searchChoices.providers,
											onChange: (provider) => {
												const first = searchGroups.find((group) => group.id === provider)?.models[0];
												setSearchDraft({
													provider,
													...first === void 0 ? {} : { model: first.id }
												});
											}
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
											label: props.t("model"),
											value: searchDraft.model,
											disabled: busy === "search" || !search.writable || searchError !== void 0,
											choices: searchChoices.models,
											onChange: (model) => {
												setSearchDraft({
													...searchDraft,
													model
												});
											}
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Actions, {
										t: props.t,
										busy: busy === "search",
										disabled: capabilityDisabled("search", search, searchDraft) || searchError !== void 0 || !searchGroups.some((group) => group.id === searchDraft.provider && group.models.some((model) => model.id === searchDraft.model)),
										...message?.route === "search" ? { message: message.text } : {},
										onCancel: () => {
											resetSearch();
											setMessage(void 0);
										},
										onSave: () => {
											saveCapability("search", search, searchDraft);
										}
									})
								] })
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RouteCard, {
								title: props.t("search"),
								summary: searchError ?? unavailable("searchProviderAdapters"),
								icon: "search",
								open: false,
								onToggle: () => {},
								disabled: true,
								badge: props.t("unavailable"),
								badgeWarn: true
							}),
							props.capabilities.imageProviderAdapters.available ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RouteCard, {
								title: props.t("image"),
								summary: imageDraft === void 0 ? props.t("loading") : routeName(groups, imageDraft),
								icon: "image",
								open: open === "image",
								onToggle: () => {
									toggle("image");
								},
								children: imageDraft === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: ModelSwitchSettings_module_css_default.hint,
									children: props.t("loading")
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: ModelSwitchSettings_module_css_default.hint,
										children: props.t("imageHelp")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: ModelSwitchSettings_module_css_default.formGrid,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
											label: props.t("provider"),
											value: imageDraft.provider,
											disabled: busy === "image" || !image.writable,
											choices: imageChoices.providers,
											onChange: (provider) => {
												const model = provider === "grok" ? "grok-imagine-image-quality" : groups.find((group) => group.id === provider)?.models[0]?.id;
												setImageDraft({
													provider,
													...model === void 0 ? {} : { model }
												});
											}
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
											label: props.t("model"),
											value: imageDraft.model,
											disabled: busy === "image" || !image.writable,
											choices: imageChoices.models,
											onChange: (model) => {
												setImageDraft({
													...imageDraft,
													model
												});
											}
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Actions, {
										t: props.t,
										busy: busy === "image",
										disabled: capabilityDisabled("image", image, imageDraft),
										...message?.route === "image" ? { message: message.text } : {},
										onCancel: () => {
											resetImage();
											setMessage(void 0);
										},
										onSave: () => {
											saveCapability("image", image, imageDraft);
										}
									})
								] })
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RouteCard, {
								title: props.t("image"),
								summary: unavailable("imageProviderAdapters"),
								icon: "image",
								open: false,
								onToggle: () => {},
								disabled: true,
								badge: props.t("unavailable"),
								badgeWarn: true
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		const zh$1 = {
			nav: "模型切换",
			title: "模型切换",
			subtitle: "为主会话、子代理和能力工具设置默认模型。修改只影响新请求。",
			conversationRoutes: "对话路由",
			capabilityRoutes: "能力路由",
			settingsSynced: "设置已同步",
			defaultBadge: "默认",
			cancel: "取消",
			main: "主模型",
			provider: "提供商",
			model: "模型",
			providerDefault: "使用提供商默认值",
			providerDefaultShort: "Provider 默认",
			effort: "推理强度",
			save: "保存",
			saving: "保存中…",
			saved: "已保存",
			subagent: "子代理",
			subagentMode: "路由策略",
			subagentFollowMain: "跟随主模型",
			subagentFixed: "固定模型",
			agentBadge: "Agent",
			search: "Web 搜索",
			searchHelp: "下拉选择的是期望使用的搜索 Adapter/模型；仅当全局 Web searchProvider=model-switch 时官方 web_search 才会使用该选择，否则保持原有路由不变。",
			image: "图像生成",
			imageHelp: "统一 generate_image 会调用所选 Codex 或 Grok Adapter；Provider 原有图片工具仍保留。",
			unavailable: "未接入",
			loading: "正在加载设置…",
			readonly: "设置为只读",
			requestFailed: "保存失败",
			catalogFailed: "无法加载模型目录。",
			conflict: "设置已在其他位置更改，请检查最新值后重试。",
			"reason.central-subagent-routing": "Alpha.4 没有全局子代理启动路由接口。",
			"reason.packaged-preset-roots": "Alpha.4 不支持插件提供额外 preset root。",
			"reason.tool-owner-suppression": "Alpha.4 没有工具所有者或来源抑制接口。",
			"reason.search-provider-adapters": "当前公开版本没有可按模型切换的搜索 Provider Adapter。",
			"reason.vision-provider-adapters": "尚无 Provider 注册可独立路由的 Vision Adapter。",
			"reason.image-provider-adapters": "当前公开版本没有图像生成 Provider Adapter。"
		};
		const en$1 = {
			nav: "Model Switch",
			title: "Model Switch",
			subtitle: "Set default models for Main, Subagents, and capability tools. Changes affect new requests only.",
			conversationRoutes: "Conversation routes",
			capabilityRoutes: "Capability routes",
			settingsSynced: "Settings synced",
			defaultBadge: "Default",
			cancel: "Cancel",
			main: "Main model",
			provider: "Provider",
			model: "Model",
			providerDefault: "Provider default",
			providerDefaultShort: "Provider default",
			effort: "Reasoning effort",
			save: "Save",
			saving: "Saving…",
			saved: "Saved",
			subagent: "Subagent",
			subagentMode: "Routing policy",
			subagentFollowMain: "Follow Main",
			subagentFixed: "Fixed model",
			agentBadge: "Agent",
			search: "Web search",
			searchHelp: "The dropdown selects the requested search adapter/model. The official web_search uses it only when the global Web searchProvider is model-switch; otherwise the original route is unchanged.",
			image: "Image generation",
			imageHelp: "The stable generate_image tool calls the selected Codex or Grok Adapter; existing provider image tools remain available.",
			unavailable: "Unavailable",
			loading: "Loading settings…",
			readonly: "Settings are read-only",
			requestFailed: "Save failed",
			catalogFailed: "Could not load the model catalog.",
			conflict: "Settings changed elsewhere. Review the latest values and retry.",
			"reason.central-subagent-routing": "Alpha.4 exposes no global Subagent start-routing seam.",
			"reason.packaged-preset-roots": "Alpha.4 exposes no plugin-owned preset root.",
			"reason.tool-owner-suppression": "Alpha.4 exposes no tool owner or provenance suppression seam.",
			"reason.search-provider-adapters": "This release exposes no model-selectable Search provider adapter.",
			"reason.vision-provider-adapters": "No Provider has registered an independently routable Vision Adapter.",
			"reason.image-provider-adapters": "This release exposes no image-generation provider adapter."
		};
		//#endregion
		//#region node_modules/.pnpm/dsh-llm-providers-ui@https+++github.com+NOirBRight+dsh-llm-providers-ui+releases+downlo_8f36d7f293f2afef29b89afaf5dd1428/node_modules/dsh-llm-providers-ui/lib/order.js
		const PROVIDERS_SETTINGS_NS = "llm-providers";
		/** Display order for installed provider cards when the user has not saved one. */
		const PROVIDER_ITEM_ORDER = [
			"llm-cursor",
			"llm-grok",
			"llm-codex",
			"llm-ollama",
			"llm-commandcode",
			"llm-opencode-go"
		];
		const KNOWN_KEYS = new Set(PROVIDER_ITEM_ORDER);
		/** settings.provider.item key to llm route id used by session.models / the picker. */
		const PROVIDER_ROUTES = {
			"llm-cursor": "cursor",
			"llm-grok": "grok",
			"llm-codex": "codex",
			"llm-ollama": "ollama-cloud",
			"llm-commandcode": "commandcode",
			"llm-opencode-go": "opencode-go"
		};
		const ROUTE_TO_KEY = new Map(Object.entries(PROVIDER_ROUTES).map(([key, route]) => [route, key]));
		function decodeStringList(value) {
			return Array.isArray(value) ? value.filter((entry) => typeof entry === "string" && entry.length > 0) : [];
		}
		/** Decode the llm-providers settings section. Unknown input becomes an empty order with nothing hidden. */
		function decodeProviderOrder(value) {
			if (value === null || typeof value !== "object" || Array.isArray(value)) return {
				order: [],
				hiddenUsageProviders: [],
				usageOrder: []
			};
			const record = value;
			return {
				order: decodeStringList(record.order),
				hiddenUsageProviders: decodeStringList(record.hiddenUsageProviders),
				usageOrder: decodeStringList(record.usageOrder)
			};
		}
		/**
		* Merge a saved key list with the keys that are actually installed.
		* Saved keys that are not installed are dropped; installed keys missing from
		* the save append in PROVIDER_ITEM_ORDER, then leftover unknown keys.
		* Nothing registered yields an empty list (the settings empty state).
		*/
		function applySavedOrder(registered, saved = []) {
			const have = [...new Set(registered.filter((key) => key.length > 0))];
			if (have.length === 0) return [];
			const installed = new Set(have);
			const preferredSaved = [...new Set(saved)].filter((key) => installed.has(key));
			const preferred = new Set(preferredSaved);
			const rest = have.filter((key) => !preferred.has(key));
			const known = PROVIDER_ITEM_ORDER.filter((key) => rest.includes(key));
			const extra = rest.filter((key) => !KNOWN_KEYS.has(key));
			return [
				...preferredSaved,
				...known,
				...extra
			];
		}
		/** Map a settings.provider.item key to its llm route id when known. */
		function providerRoute(key) {
			return PROVIDER_ROUTES[key];
		}
		/**
		* Sort picker/catalog groups: mapped providers follow saved card order,
		* groups the map does not know keep catalog order and append after.
		*/
		function sortCatalogGroups(groups, saved = []) {
			const ranked = applySavedOrder(groups.map((group) => ROUTE_TO_KEY.get(group.id)).filter((key) => key !== void 0), saved);
			const rank = new Map(ranked.flatMap((key, index) => {
				const route = providerRoute(key);
				return route === void 0 ? [] : [[route, index]];
			}));
			const known = [];
			const unknown = [];
			for (const group of groups) if (rank.has(group.id)) known.push(group);
			else unknown.push(group);
			known.sort((left, right) => (rank.get(left.id) ?? 0) - (rank.get(right.id) ?? 0));
			return [...known, ...unknown];
		}
		//#endregion
		//#region src/picker/plan-review.ts
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
		var PlanApprovalResponseError = class extends Error {};
		async function approvePlanReview(args) {
			const current = args.current;
			if (!(current !== void 0 && current !== null && current.provider === args.selection.provider && current.model === args.selection.model && current.reasoningEffort === args.selection.reasoningEffort) && !await args.select(args.selection)) return false;
			await args.answer();
			return true;
		}
		function planActionView(state, available, hasExecution) {
			return {
				approveDisabled: state.busy || state.blocked || !available || !hasExecution,
				error: state.error
			};
		}
		async function settlePlanAction(send, update) {
			update({
				busy: true,
				blocked: false,
				error: null
			});
			try {
				await send();
				return true;
			} catch (cause) {
				update({
					busy: false,
					blocked: cause instanceof PlanApprovalResponseError,
					error: cause instanceof Error ? cause.message : String(cause)
				});
				return false;
			}
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
		/** Catalog id for a standard-row window that the Host did not publish. UI localizes this. */
		const STANDARD_CONTEXT_LABEL = "standard";
		/** Human label for a context tier: 1M, 272K, or STANDARD_CONTEXT_LABEL when its window is unknown. */
		function contextTierLabel(tier, tokens) {
			if (tier === null) return tokens === void 0 ? STANDARD_CONTEXT_LABEL : formatWindow(tokens);
			const match = /^(\d+)(k|m)$/iu.exec(tier);
			if (match !== null) return `${match[1]}${match[2].toUpperCase()}`;
			return tokens === void 0 ? tier : formatWindow(tokens);
		}
		/** Compact token window for trigger / context-cell copy. */
		function formatWindow(tokens) {
			if (tokens >= 1e6 && tokens % 1e6 === 0) return `${tokens / 1e6}M`;
			if (tokens >= 1e3 && tokens % 1e3 === 0) return `${tokens / 1e3}K`;
			if (tokens >= 1e3) return `${Math.round(tokens / 1e3)}K`;
			return String(tokens);
		}
		/** Standard-row window when the Host directory omits contextWindow. */
		function impliedStandardTokens(base) {
			if (/^gpt-5\.6(?:-|$)/u.test(base)) return 272e3;
		}
		/** Label a selected variant from catalog identity, never from stale session pressure. */
		function contextLabelForMember(family, member) {
			const tokens = member.contextTokens ?? (member.contextTier === null ? impliedStandardTokens(family.base) : void 0);
			return contextTierLabel(member.contextTier, tokens);
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
		/** Locate the family that owns a provider/model pair. */
		function findFamily(families, provider, modelId) {
			return families.find((family) => family.provider === provider && family.members.some((member) => member.model.id === modelId));
		}
		/** Locate one family member by catalog id. */
		function findMember(family, modelId) {
			return family.members.find((member) => member.model.id === modelId);
		}
		/** Pick a sibling after toggling Fast / context / thinking, keeping the other axes. */
		function pickVariant(family, current, patch) {
			const fast = patch.fast ?? current.fast;
			const contextTier = patch.contextTier !== void 0 ? patch.contextTier : current.contextTier;
			const thinking = patch.thinking ?? current.thinking;
			const exact = family.members.find((member) => member.fast === fast && member.contextTier === contextTier && member.thinking === thinking);
			if (exact !== void 0) return exact;
			const sameTier = family.members.find((member) => member.fast === fast && member.contextTier === contextTier);
			if (sameTier !== void 0) return sameTier;
			return family.members.find((member) => member.fast === fast) ?? family.members[0] ?? current;
		}
		/** Fast row appears only when both a Fast and a non-Fast sibling exist. */
		function familyHasFast(family) {
			return family.members.some((member) => member.fast) && family.members.some((member) => !member.fast);
		}
		function displayNameOf(name, parsed) {
			let next = name;
			if (parsed.fast) next = next.replace(/\s+Fast$/iu, "");
			if (parsed.contextTier !== null) next = next.replace(/\s+(?:Max|1M)$/iu, "");
			return next.replace(/\s+/gu, " ").trim() || name;
		}
		/** Provider sections in catalog order, for the model pane. */
		function sectionFamilies(families) {
			const sections = [];
			const index = /* @__PURE__ */ new Map();
			for (const family of families) {
				let section = index.get(family.provider);
				if (section === void 0) {
					section = {
						provider: family.provider,
						providerName: family.providerName,
						families: []
					};
					index.set(family.provider, section);
					sections.push(section);
				}
				section.families.push(family);
			}
			return sections;
		}
		/** Unique context tiers in catalog order. */
		function contextTiers(family, standardTokens) {
			const seen = /* @__PURE__ */ new Set();
			const rows = [];
			for (const member of family.members) {
				const tokens = member.contextTier === null ? member.contextTokens ?? standardTokens ?? impliedStandardTokens(family.base) : member.contextTokens;
				const label = contextTierLabel(member.contextTier, tokens);
				if (seen.has(label)) continue;
				seen.add(label);
				rows.push({
					tier: member.contextTier,
					label,
					...tokens === void 0 ? {} : { tokens }
				});
			}
			return rows;
		}
		/** Context row appears only when the family has more than one tier. */
		function familyHasContextChoices(family) {
			return contextTiers(family).length > 1;
		}
		/** Thinking on/off siblings at the current Fast + context axes, or null. */
		function thinkingSiblings(family, current) {
			const on = family.members.find((member) => member.fast === current.fast && member.contextTier === current.contextTier && member.thinking);
			const off = family.members.find((member) => member.fast === current.fast && member.contextTier === current.contextTier && !member.thinking);
			if (on === void 0 || off === void 0) return null;
			return {
				on,
				off
			};
		}
		/** Case-insensitive local search over family name, base, and provider. */
		function filterFamilies(families, query) {
			const needle = query.trim().toLowerCase();
			if (needle.length === 0) return [...families];
			return families.filter((family) => family.name.toLowerCase().includes(needle) || family.base.toLowerCase().includes(needle) || family.providerName.toLowerCase().includes(needle) || family.members.some((member) => member.model.id.toLowerCase().includes(needle)));
		}
		/** Build a Host selection from a member, preserving or defaulting effort. */
		function selectionOf(family, member, reasoningEffort) {
			const reasoning = member.model.reasoning;
			const effort = reasoningEffort !== void 0 && reasoning?.efforts.some((level) => level.id === reasoningEffort) ? reasoningEffort : reasoning?.defaultEffort;
			return {
				provider: family.provider,
				model: member.model.id,
				...effort === void 0 ? {} : { reasoningEffort: effort }
			};
		}
		//#endregion
		//#region src/picker/selection-feedback.ts
		/** Immediate picker feedback around an asynchronous Host model selection. */
		async function beginSelection(select, showFeedback, settle) {
			showFeedback();
			settle(await select());
		}
		//#endregion
		//#region src/client/picker/popup-dismissal.ts
		/** Install capture-phase outside-pointer dismissal and optional mobile Back registration. */
		function installPickerDismissal({ documentTarget, surfaceId, interaction, trigger, popup, dismiss }) {
			let unregister = () => {};
			try {
				unregister = interaction?.registerSurface({
					id: surfaceId,
					kind: "popup",
					dismiss: () => {
						dismiss();
					}
				}) ?? unregister;
			} catch (error) {
				console.warn("dsh-model-switch: optional interaction surface registration failed", error);
			}
			const onPointerDown = (event) => {
				const target = event.target;
				if (!(target instanceof Node)) return;
				if (trigger()?.contains(target) || popup()?.contains(target)) return;
				dismiss();
			};
			documentTarget.addEventListener("pointerdown", onPointerDown, true);
			return () => {
				documentTarget.removeEventListener("pointerdown", onPointerDown, true);
				unregister();
			};
		}
		//#endregion
		//#region src/client/picker/useComposerPickerSurface.ts
		/** Own popup activation, positioning, and dismissal behind one internal seam. */
		function useComposerPickerSurface(options) {
			const [open, setOpen] = (0, react.useState)(false);
			const [menuStyle, setMenuStyle] = (0, react.useState)({
				position: "fixed",
				zIndex: 4e3
			});
			const triggerRef = (0, react.useRef)(null);
			const menuRef = (0, react.useRef)(null);
			const pointerOpenIntent = (0, react.useRef)(null);
			const callbacks = (0, react.useRef)({
				onOpen: options.onOpen,
				onClose: options.onClose
			});
			callbacks.current = {
				onOpen: options.onOpen,
				onClose: options.onClose
			};
			const lockedRef = (0, react.useRef)(options.locked);
			lockedRef.current = options.locked;
			const id = (0, react.useId)();
			const close = (0, react.useCallback)((restoreFocus = false) => {
				setOpen(false);
				callbacks.current.onClose();
				if (restoreFocus) queueMicrotask(() => {
					triggerRef.current?.focus();
				});
			}, []);
			const show = () => {
				if (lockedRef.current) return;
				callbacks.current.onOpen();
				setOpen(true);
				if (options.tone !== "capsule") options.reload();
			};
			(0, react.useEffect)(() => {
				if (options.locked) close();
			}, [close, options.locked]);
			(0, react.useLayoutEffect)(() => {
				if (!open) return;
				const trigger = triggerRef.current;
				if (trigger === null) return;
				const rect = trigger.getBoundingClientRect();
				const gutter = 8;
				const maxWidth = Math.min(420, window.innerWidth - 16);
				const preferredWidth = Math.min(320, maxWidth);
				const safeRight = "max(" + Math.min(Math.max(gutter, window.innerWidth - rect.right), Math.max(gutter, window.innerWidth - gutter - preferredWidth)) + "px, calc(env(safe-area-inset-right) + 8px))";
				setMenuStyle({
					position: "fixed",
					right: safeRight,
					bottom: "max(" + Math.max(gutter, window.innerHeight - rect.top + gutter) + "px, calc(env(safe-area-inset-bottom) + 8px))",
					maxWidth: "max(0px, calc(100vw - " + safeRight + " - env(safe-area-inset-left) - 8px))",
					zIndex: 4e3
				});
			}, [
				open,
				options.embedded,
				options.pane
			]);
			(0, react.useEffect)(() => {
				if (!open || options.tone === "capsule") return;
				const interaction = options.resolveInteractionOperations?.();
				return installPickerDismissal({
					documentTarget: document,
					surfaceId: "composer-model-picker-" + id,
					...interaction === void 0 ? {} : { interaction },
					trigger: () => triggerRef.current,
					popup: () => menuRef.current,
					dismiss: close
				});
			}, [
				close,
				id,
				open,
				options.resolveInteractionOperations,
				options.tone
			]);
			return {
				id,
				open,
				menuStyle,
				triggerRef,
				menuRef,
				show,
				close,
				onTriggerPointerDown: (event) => {
					event.stopPropagation();
					pointerOpenIntent.current = {
						open: !open,
						until: Date.now() + 750
					};
				},
				onTriggerClick: (event) => {
					event?.stopPropagation();
					const intent = pointerOpenIntent.current;
					const desiredOpen = intent !== null && Date.now() <= intent.until ? intent.open : !open;
					if (intent !== null && Date.now() > intent.until) pointerOpenIntent.current = null;
					if (desiredOpen) show();
					else close();
				}
			};
		}
		const RUNTIME_LOCK_TARGET = "model-switch.runtime-lock";
		function isSessionReady(event) {
			if (event.type !== "antigravity/session-ready" || event.data === null || typeof event.data !== "object") return false;
			return event.data.provider === ANTIGRAVITY_PROVIDER_KEY;
		}
		/** Project the first successful native Antigravity session startup into a durable lock node. */
		const antigravityRuntimeLockEvent = {
			kind: "model-switch.antigravity-runtime-lock",
			target: RUNTIME_LOCK_TARGET,
			match: (event) => isSessionReady(event) ? {
				id: ANTIGRAVITY_PROVIDER_KEY,
				role: "start"
			} : null,
			start: () => ANTIGRAVITY_PROVIDER_KEY,
			update: (context) => context.state,
			buildViewNode: (context) => context.state === void 0 ? null : {
				key: context.key,
				kind: context.kind,
				id: context.id,
				target: RUNTIME_LOCK_TARGET,
				data: context.state
			}
		};
		/** Fold runtime-lock nodes into the provider allowed for the rest of the Session. */
		const antigravityRuntimeLockView = {
			target: RUNTIME_LOCK_TARGET,
			create: () => {
				let current = null;
				return {
					empty: null,
					replace: ({ nodes }) => {
						current = nodes.some((node) => node.data === "antigravity") ? ANTIGRAVITY_PROVIDER_KEY : null;
						return current;
					},
					apply: ({ upserts }) => {
						if (upserts.some((node) => node.data === "antigravity")) current = ANTIGRAVITY_PROVIDER_KEY;
						return current;
					}
				};
			},
			isActive: () => false
		};
		/** Whether one provider remains selectable under the Session runtime lock. */
		function providerSelectable(lock, provider) {
			return lock === null || provider === lock;
		}
		/** Register the replayable event projection when Conversation assembly is present. */
		function installAntigravityRuntimeLock(ctx) {
			ctx.inject(["uiConversation"], (scope) => {
				scope.effect(() => scope.uiConversation.views.register(antigravityRuntimeLockView), "dsh-model-switch: Antigravity runtime lock view");
				scope.effect(() => scope.uiConversation.events.register(antigravityRuntimeLockEvent), "dsh-model-switch: Antigravity runtime lock event");
			});
		}
		//#endregion
		//#region \0dsh-css:src/client/picker/ComposerPicker.module.css.mjs
		const css$1 = ".GdQohq_root{min-width:0;position:relative}.GdQohq_trigger{width:fit-content;min-width:0;max-width:256px;min-height:28px;color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xs-strong-13);cursor:pointer;background:0 0;border:none;border-radius:24px;outline:none;align-items:center;gap:4px;padding:4px 4px 4px 8px;display:flex}.GdQohq_trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.GdQohq_trigger:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}.GdQohq_trigger:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}.GdQohq_triggerLabel{overflow-wrap:normal;text-overflow:ellipsis;white-space:nowrap;align-items:center;gap:4px;min-width:0;display:inline-flex;overflow:hidden}.GdQohq_triggerEffort{color:var(--dsw-alias-label-caption);flex:none}.GdQohq_chevron{color:var(--dsw-alias-label-caption);transition:transform .12s var(--ds-ease-in-out);flex:none}.GdQohq_chevronOpen{transform:rotate(180deg)}.GdQohq_embedded{width:100%}.GdQohq_embedded .GdQohq_trigger{background:var(--dsw-alias-interactive-bg-hover);width:100%;max-width:none;min-height:36px;color:var(--dsw-alias-label-primary);border-radius:10px;justify-content:space-between;padding:4px 10px}.GdQohq_embedded .GdQohq_trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.GdQohq_capsule{width:100%}.GdQohq_capsule .GdQohq_trigger{border:1px solid var(--dsw-alias-border-inverted);background:var(--dsw-specific-input-major);width:100%;max-width:none;min-height:32px;color:var(--dsw-alias-label-primary);border-radius:24px;justify-content:space-between;padding:4px 8px 4px 10px}.GdQohq_capsule .GdQohq_trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.GdQohq_menu{box-sizing:border-box;width:min(280px, max(0px, calc(100vw - 32px - env(safe-area-inset-left) - env(safe-area-inset-right))));max-height:min(360px, calc(56dvh - env(safe-area-inset-bottom)));border:1px solid var(--dsw-alias-border-inverted);background:var(--dsw-specific-menu);box-shadow:var(--dsw-shadow-lv3);color:var(--dsw-alias-label-primary);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border-radius:12px;flex-direction:column;padding:4px;display:flex;overflow:hidden}.GdQohq_paneHeader{flex:none;grid-template-columns:32px minmax(0,1fr) 32px;align-items:center;gap:8px;min-height:40px;padding:2px 4px;display:grid}.GdQohq_paneHeader .GdQohq_headerButton{width:32px;min-width:32px;height:32px;color:var(--dsw-alias-label-secondary);padding:0}.GdQohq_paneHeader .GdQohq_headerButton:last-child{justify-self:end}.GdQohq_paneTitle{min-width:0;color:var(--dsw-alias-label-primary);font:var(--dsw-font-s-strong-14);overflow-wrap:anywhere;text-align:center;padding:4px 8px}.GdQohq_searchSlot{min-width:0;overflow:hidden}.GdQohq_headerSearch{box-sizing:border-box;width:100%;min-width:0;max-width:100%;display:flex}.GdQohq_headerSearch input::-webkit-search-cancel-button{display:none}.GdQohq_list{min-height:0;overflow:hidden auto}.GdQohq_status,.GdQohq_empty{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xs-13);overflow-wrap:anywhere;padding:10px}.GdQohq_error,.GdQohq_warning{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);font:var(--dsw-font-xxs-12);overflow-wrap:anywhere;border-radius:8px;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px;padding:7px 8px;display:flex}.GdQohq_warning{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-state-warn-label)}.GdQohq_retry{color:inherit;font:var(--dsw-font-xxs-strong-12);cursor:pointer;background:0 0;border:none;flex:none;padding:0}.GdQohq_groups{min-height:0}.GdQohq_group+.GdQohq_group{margin-top:4px}.GdQohq_groupTitle{z-index:1;background:var(--dsw-specific-menu);color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxs-strong-12);overflow-wrap:anywhere;align-items:center;gap:6px;padding:5px 8px 3px;display:flex;position:sticky;top:0}.GdQohq_runtimeMark{min-width:14px;font:var(--dsw-font-xxs-strong-12);opacity:.75;justify-content:center;align-items:center;display:inline-flex}.GdQohq_option{box-sizing:border-box;width:auto;min-width:100%;min-height:38px;color:inherit;text-align:left;cursor:pointer;background:0 0;border:none;border-radius:10px;outline:none;align-items:center;gap:8px;padding:6px 8px;display:flex}.GdQohq_option:hover:not(:disabled),.GdQohq_option:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}.GdQohq_selected{background:0 0}.GdQohq_option:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}.GdQohq_optionCopy{flex-direction:column;flex:1;min-width:0;display:flex}.GdQohq_modelName{color:inherit;font:var(--dsw-font-s-strong-14);overflow-wrap:anywhere}.GdQohq_description{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxs-12);overflow-wrap:anywhere}.GdQohq_check{color:var(--dsw-alias-label-primary);flex:0 0 18px;place-items:center;display:grid}.GdQohq_cell{box-sizing:border-box;width:auto;min-width:100%;height:40px;min-height:40px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-s-14);cursor:pointer;text-align:left;background:0 0;border:none;border-radius:10px;align-items:center;gap:8px;padding:0 10px;display:flex}.GdQohq_cell:hover{background:var(--dsw-alias-interactive-bg-hover)}.GdQohq_cellLabel{white-space:nowrap;flex:none}.GdQohq_cellValue{min-width:0;color:var(--dsw-alias-label-tertiary);text-align:right;text-overflow:ellipsis;white-space:nowrap;flex:auto;overflow:hidden}.GdQohq_cellChevron{color:var(--dsw-alias-label-tertiary);flex:none}";
		const tagId$1 = "dsh-model-switch/ComposerPicker.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-model-switch";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var ComposerPicker_module_css_default = {
			"capsule": "GdQohq_capsule",
			"cell": "GdQohq_cell",
			"cellChevron": "GdQohq_cellChevron",
			"cellLabel": "GdQohq_cellLabel",
			"cellValue": "GdQohq_cellValue",
			"check": "GdQohq_check",
			"chevron": "GdQohq_chevron",
			"chevronOpen": "GdQohq_chevronOpen",
			"description": "GdQohq_description",
			"embedded": "GdQohq_embedded",
			"empty": "GdQohq_empty",
			"error": "GdQohq_error",
			"group": "GdQohq_group",
			"groups": "GdQohq_groups",
			"groupTitle": "GdQohq_groupTitle",
			"headerButton": "GdQohq_headerButton",
			"headerSearch": "GdQohq_headerSearch",
			"list": "GdQohq_list",
			"menu": "GdQohq_menu",
			"modelName": "GdQohq_modelName",
			"option": "GdQohq_option",
			"optionCopy": "GdQohq_optionCopy",
			"paneHeader": "GdQohq_paneHeader",
			"paneTitle": "GdQohq_paneTitle",
			"retry": "GdQohq_retry",
			"root": "GdQohq_root",
			"runtimeMark": "GdQohq_runtimeMark",
			"searchSlot": "GdQohq_searchSlot",
			"selected": "GdQohq_selected",
			"status": "GdQohq_status",
			"trigger": "GdQohq_trigger",
			"triggerEffort": "GdQohq_triggerEffort",
			"triggerLabel": "GdQohq_triggerLabel",
			"warning": "GdQohq_warning"
		};
		//#endregion
		//#region src/client/picker/ComposerPicker.tsx
		/**
		* Composer model seat: suffix-grouped Model / Effort / Context / Fast / Thinking.
		*/
		function sameSelection(left, right) {
			return left?.provider === right?.provider && left?.model === right?.model && left?.reasoningEffort === right?.reasoningEffort;
		}
		function classNames(...parts) {
			return parts.filter((part) => typeof part === "string" && part.length > 0).join(" ");
		}
		function ModelPaneHeader({ title, backLabel, searchLabel, closeSearchLabel, searchable, searching, query, onBack, onStartSearch, onCloseSearch, onQueryChange }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: ComposerPicker_module_css_default.paneHeader,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "ghost",
						size: "sm",
						className: ComposerPicker_module_css_default.headerButton,
						icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronLeftOutline14, {}),
						"aria-label": backLabel,
						onClick: onBack
					}),
					searching ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: ComposerPicker_module_css_default.searchSlot,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
							className: ComposerPicker_module_css_default.headerSearch ?? "",
							type: "search",
							autoFocus: true,
							value: query,
							placeholder: searchLabel,
							"aria-label": searchLabel,
							onChange: (event) => {
								onQueryChange(event.currentTarget.value);
							}
						})
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: ComposerPicker_module_css_default.paneTitle,
						children: title
					}),
					searchable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "ghost",
						size: "sm",
						className: ComposerPicker_module_css_default.headerButton,
						icon: searching ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutline16, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutline16, {}),
						"aria-label": searching ? closeSearchLabel : searchLabel,
						onClick: searching ? onCloseSearch : onStartSearch
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { "aria-hidden": true })
				]
			});
		}
		function RuntimeIcon({ provider }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: ComposerPicker_module_css_default.runtimeMark,
				children: provider.slice(0, 1).toUpperCase()
			});
		}
		function ComposerPicker({ locked, providerLock = null, available, directory, t, draft, onDraftChange, embedded, tone, resolveInteractionOperations }) {
			const { snapshot: state, getDirectorySnapshot, load, select } = directory;
			const [pane, setPane] = (0, react.useState)("root");
			const [searching, setSearching] = (0, react.useState)(false);
			const [query, setQuery] = (0, react.useState)("");
			const [toast, setToast] = (0, react.useState)(null);
			const [acceptedSelection, setAcceptedSelection] = (0, react.useState)();
			const toastSeq = (0, react.useRef)(0);
			const selectionGeneration = (0, react.useRef)(0);
			const lastActionRef = (0, react.useRef)("load");
			const lockedRef = (0, react.useRef)(locked);
			lockedRef.current = locked;
			const families = (0, react.useMemo)(() => groupFamilies(state.groups), [state.groups]);
			const currentSelection = draft ?? acceptedSelection?.selection ?? state.current;
			const currentCanBeUsed = draft !== void 0 || acceptedSelection !== void 0 || state.routable !== false;
			const family = currentSelection === null ? void 0 : findFamily(families, currentSelection.provider, currentSelection.model);
			const member = family === void 0 || currentSelection === null ? void 0 : findMember(family, currentSelection.model);
			const reasoning = member?.model.reasoning;
			const effectiveEffort = currentSelection?.reasoningEffort ?? reasoning?.defaultEffort;
			const effortLabel = reasoning === void 0 ? void 0 : effectiveEffort === void 0 ? t("effort.providerDefault") : reasoning.efforts.find((level) => level.id === effectiveEffort)?.name ?? effectiveEffort;
			const contextLabel = family === void 0 || member === void 0 ? void 0 : contextLabelForMember(family, member);
			const thinkingPair = family !== void 0 && member !== void 0 ? thinkingSiblings(family, member) : null;
			const visibleFamilies = (0, react.useMemo)(() => filterFamilies(families, query), [families, query]);
			const sections = (0, react.useMemo)(() => sectionFamilies(visibleFamilies), [visibleFamilies]);
			const busy = state.status === "selecting";
			const reload = () => {
				if (lockedRef.current) return;
				lastActionRef.current = "load";
				load();
			};
			const { id, open, menuStyle, triggerRef, menuRef, close, onTriggerPointerDown, onTriggerClick } = useComposerPickerSurface({
				locked,
				embedded: embedded ?? false,
				pane,
				reload,
				onOpen: () => {
					setPane(embedded && tone !== "capsule" ? "model" : "root");
					setSearching(false);
					setQuery("");
				},
				onClose: () => {
					setPane("root");
					setSearching(false);
					setQuery("");
				},
				...tone === void 0 ? {} : { tone },
				...resolveInteractionOperations === void 0 ? {} : { resolveInteractionOperations }
			});
			(0, react.useEffect)(() => {
				if (available) {
					lastActionRef.current = "load";
					load();
					return;
				}
				selectionGeneration.current += 1;
				setAcceptedSelection(void 0);
			}, [available, load]);
			(0, react.useEffect)(() => {
				if (acceptedSelection === void 0) return;
				if (!sameSelection(state.current, acceptedSelection.projectedBeforeRequest)) setAcceptedSelection(void 0);
			}, [acceptedSelection, state.current]);
			(0, react.useEffect)(() => {
				if (!locked) return;
				selectionGeneration.current += 1;
				setAcceptedSelection(void 0);
			}, [locked]);
			if (!available) return null;
			const returnToRoot = () => {
				setPane("root");
				setSearching(false);
				setQuery("");
			};
			const settleSelection = (accepted) => {
				if (accepted) return;
				const message = getDirectorySnapshot().error;
				if (message !== null) {
					toastSeq.current += 1;
					setToast({
						seq: toastSeq.current,
						text: t("error.action", { message })
					});
				}
			};
			const applySelection = (next) => {
				if (lockedRef.current || !providerSelectable(providerLock, next.provider)) return;
				if (onDraftChange !== void 0) {
					onDraftChange(next);
					returnToRoot();
					return;
				}
				if (currentCanBeUsed && sameSelection(currentSelection, next)) {
					returnToRoot();
					return;
				}
				lastActionRef.current = "select";
				if (select !== void 0) {
					const generation = ++selectionGeneration.current;
					const projectedBeforeRequest = state.current;
					beginSelection(() => select(next), returnToRoot, (accepted) => {
						if (generation !== selectionGeneration.current || lockedRef.current) return;
						if (accepted) setAcceptedSelection({
							selection: next,
							projectedBeforeRequest
						});
						settleSelection(accepted);
					});
				}
			};
			const chooseMember = (nextFamily, next, effort) => {
				applySelection(selectionOf(nextFamily, next, effort));
			};
			const chooseEffort = (effort) => {
				if (family === void 0 || member === void 0) return;
				applySelection(selectionOf(family, member, effort));
			};
			const modelLabel = family?.name ?? member?.model.name ?? currentSelection?.model ?? t("trigger.fallback");
			const contextBit = contextLabel === void 0 || contextLabel === "standard" ? void 0 : member?.contextTier === null ? void 0 : contextLabel;
			const triggerBits = [
				modelLabel,
				...effortLabel === void 0 ? [] : [effortLabel],
				...member?.fast === true ? [t("menu.fast")] : [],
				...contextBit === void 0 ? [] : [contextBit],
				...thinkingPair !== null && member?.thinking === true ? [t("menu.thinking")] : []
			];
			const contextDisplay = (label) => label === "standard" ? t("context.standard") : label;
			const triggerLabel = triggerBits.join(" · ");
			const triggerAria = currentSelection === null ? t("trigger.selectAria") : t("trigger.aria", { model: triggerLabel });
			const onRootKeyDown = (event) => {
				if (lockedRef.current) return;
				if (event.key === "Escape" && open) {
					event.preventDefault();
					if (pane === "model" && searching) {
						setSearching(false);
						setQuery("");
					} else if (pane !== "root") returnToRoot();
					else close(true);
				}
			};
			const paneHeader = pane === "root" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelPaneHeader, {
				title: t({
					model: "menu.model",
					effort: "menu.effort",
					context: "menu.context",
					fast: "menu.fast",
					thinking: "menu.thinking"
				}[pane]),
				backLabel: t("menu.back"),
				searchLabel: t("menu.search"),
				closeSearchLabel: t("menu.closeSearch"),
				searchable: pane === "model",
				searching: pane === "model" && searching,
				query,
				onBack: returnToRoot,
				onStartSearch: () => {
					setSearching(true);
				},
				onCloseSearch: () => {
					setSearching(false);
					setQuery("");
				},
				onQueryChange: setQuery
			});
			const menu = open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: menuRef,
				id: `${id}-menu`,
				className: ComposerPicker_module_css_default.menu,
				style: menuStyle,
				role: "menu",
				"aria-label": t("menu.aria"),
				"aria-busy": state.status === "loading" || busy,
				onPointerDown: (event) => {
					event.stopPropagation();
				},
				children: [paneHeader, /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: ComposerPicker_module_css_default.list,
					children: [
						pane === "root" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "menuitem",
								className: ComposerPicker_module_css_default.cell,
								onClick: () => {
									setPane("model");
									setSearching(false);
									setQuery("");
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ComposerPicker_module_css_default.cellLabel,
										children: t("menu.model")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ComposerPicker_module_css_default.cellValue,
										children: family?.name ?? modelLabel
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutline14, { className: ComposerPicker_module_css_default.cellChevron })
								]
							}),
							reasoning !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "menuitem",
								className: ComposerPicker_module_css_default.cell,
								onClick: () => {
									setPane("effort");
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ComposerPicker_module_css_default.cellLabel,
										children: t("menu.effort")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ComposerPicker_module_css_default.cellValue,
										children: effortLabel
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutline14, { className: ComposerPicker_module_css_default.cellChevron })
								]
							}),
							family !== void 0 && familyHasContextChoices(family) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "menuitem",
								className: ComposerPicker_module_css_default.cell,
								onClick: () => {
									setPane("context");
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ComposerPicker_module_css_default.cellLabel,
										children: t("menu.context")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ComposerPicker_module_css_default.cellValue,
										children: contextDisplay(contextLabel ?? "")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutline14, { className: ComposerPicker_module_css_default.cellChevron })
								]
							}),
							family !== void 0 && familyHasFast(family) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "menuitem",
								className: ComposerPicker_module_css_default.cell,
								onClick: () => {
									setPane("fast");
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ComposerPicker_module_css_default.cellLabel,
										children: t("menu.fast")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ComposerPicker_module_css_default.cellValue,
										children: member?.fast === true ? t("fast.on") : t("fast.off")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutline14, { className: ComposerPicker_module_css_default.cellChevron })
								]
							}),
							thinkingPair !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "menuitem",
								className: ComposerPicker_module_css_default.cell,
								onClick: () => {
									setPane("thinking");
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ComposerPicker_module_css_default.cellLabel,
										children: t("menu.thinking")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ComposerPicker_module_css_default.cellValue,
										children: member?.thinking === true ? t("thinking.on") : t("thinking.off")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutline14, { className: ComposerPicker_module_css_default.cellChevron })
								]
							})
						] }),
						pane === "model" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							state.status === "loading" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: ComposerPicker_module_css_default.status,
								children: t("status.loading")
							}),
							state.error !== null && lastActionRef.current === "load" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ComposerPicker_module_css_default.error,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("error.action", { message: state.error }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: ComposerPicker_module_css_default.retry,
									disabled: locked,
									onClick: reload,
									children: t("retry")
								})]
							}),
							state.failures.map((failure) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ComposerPicker_module_css_default.warning,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("warning.groupLoad", {
									name: failure.name,
									message: failure.message
								}) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: ComposerPicker_module_css_default.retry,
									disabled: locked,
									onClick: reload,
									children: t("retry")
								})]
							}, failure.id)),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: classNames(ComposerPicker_module_css_default.groups, "scrollable"),
								children: sections.map((section) => {
									const headingId = `${id}-${section.provider}`;
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
										role: "group",
										"aria-labelledby": headingId,
										className: ComposerPicker_module_css_default.group,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: ComposerPicker_module_css_default.groupTitle,
											id: headingId,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RuntimeIcon, { provider: section.provider }), section.providerName]
										}), section.families.map((item) => {
											const selected = currentSelection?.provider === item.provider && item.members.some((entry) => entry.model.id === currentSelection.model);
											const representative = member !== void 0 && family?.provider === item.provider && family.base === item.base ? member : item.members.find((entry) => !entry.fast && entry.contextTier === null) ?? item.members[0];
											return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
												type: "button",
												role: "menuitemradio",
												"aria-checked": selected,
												className: classNames(ComposerPicker_module_css_default.option, selected && ComposerPicker_module_css_default.selected),
												disabled: locked || busy || !providerSelectable(providerLock, item.provider),
												onClick: () => {
													if (representative === void 0) return;
													chooseMember(item, representative);
												},
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: ComposerPicker_module_css_default.optionCopy,
													children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: ComposerPicker_module_css_default.modelName,
														children: item.name
													})
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: ComposerPicker_module_css_default.check,
													children: selected ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutline16, {}) : null
												})]
											}, `${item.provider}:${item.base}`);
										})]
									}, section.provider);
								})
							}),
							state.status === "ready" && visibleFamilies.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: ComposerPicker_module_css_default.empty,
								children: t("empty.models")
							})
						] }),
						pane === "effort" && (reasoning === void 0 || reasoning.efforts.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: ComposerPicker_module_css_default.empty,
							children: t("empty.efforts")
						}) : reasoning.efforts.map((level) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							role: "menuitemradio",
							"aria-checked": effectiveEffort === level.id,
							className: classNames(ComposerPicker_module_css_default.option, effectiveEffort === level.id && ComposerPicker_module_css_default.selected),
							disabled: locked || busy,
							onClick: () => {
								chooseEffort(level.id);
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ComposerPicker_module_css_default.optionCopy,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ComposerPicker_module_css_default.modelName,
									children: level.name
								})
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ComposerPicker_module_css_default.check,
								children: effectiveEffort === level.id ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutline16, {}) : null
							})]
						}, level.id))),
						pane === "context" && family !== void 0 && member !== void 0 && contextTiers(family).map((row) => {
							const selected = member.contextTier === row.tier;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "menuitemradio",
								"aria-checked": selected,
								className: classNames(ComposerPicker_module_css_default.option, selected && ComposerPicker_module_css_default.selected),
								disabled: locked || busy,
								onClick: () => {
									chooseMember(family, pickVariant(family, member, { contextTier: row.tier }), effectiveEffort);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ComposerPicker_module_css_default.optionCopy,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ComposerPicker_module_css_default.modelName,
										children: contextDisplay(row.label)
									})
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ComposerPicker_module_css_default.check,
									children: selected ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutline16, {}) : null
								})]
							}, row.tier ?? "standard");
						}),
						pane === "fast" && family !== void 0 && member !== void 0 && [false, true].map((fast) => {
							const selected = member.fast === fast;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "menuitemradio",
								"aria-checked": selected,
								className: classNames(ComposerPicker_module_css_default.option, selected && ComposerPicker_module_css_default.selected),
								disabled: locked || busy,
								onClick: () => {
									chooseMember(family, pickVariant(family, member, { fast }), effectiveEffort);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ComposerPicker_module_css_default.optionCopy,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ComposerPicker_module_css_default.modelName,
										children: fast ? t("fast.on") : t("fast.off")
									})
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ComposerPicker_module_css_default.check,
									children: selected ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutline16, {}) : null
								})]
							}, fast ? "on" : "off");
						}),
						pane === "thinking" && family !== void 0 && member !== void 0 && thinkingPair !== null && [{
							on: true,
							row: thinkingPair.on
						}, {
							on: false,
							row: thinkingPair.off
						}].map((choice) => {
							const selected = member.thinking === choice.on;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "menuitemradio",
								"aria-checked": selected,
								className: classNames(ComposerPicker_module_css_default.option, selected && ComposerPicker_module_css_default.selected),
								disabled: locked || busy,
								onClick: () => {
									chooseMember(family, choice.row, effectiveEffort);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ComposerPicker_module_css_default.optionCopy,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ComposerPicker_module_css_default.modelName,
										children: choice.on ? t("thinking.on") : t("thinking.off")
									})
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ComposerPicker_module_css_default.check,
									children: selected ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutline16, {}) : null
								})]
							}, choice.on ? "on" : "off");
						})
					]
				})]
			}) : null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: classNames(ComposerPicker_module_css_default.root, tone === "capsule" ? ComposerPicker_module_css_default.capsule : embedded && ComposerPicker_module_css_default.embedded),
				onKeyDown: onRootKeyDown,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						ref: triggerRef,
						type: "button",
						className: ComposerPicker_module_css_default.trigger,
						"aria-label": triggerAria,
						"aria-haspopup": "menu",
						"aria-expanded": open,
						"aria-controls": open ? `${id}-menu` : void 0,
						title: triggerLabel,
						disabled: locked,
						onPointerDown: onTriggerPointerDown,
						onClick: onTriggerClick,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: ComposerPicker_module_css_default.triggerLabel,
							children: [currentSelection !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RuntimeIcon, { provider: currentSelection.provider }) : null, triggerLabel]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, { className: classNames(ComposerPicker_module_css_default.chevron, open && ComposerPicker_module_css_default.chevronOpen) })]
					}),
					menu !== null && (tone === "capsule" ? menu : (0, react_dom.createPortal)(menu, document.body)),
					toast !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
						text: toast.text,
						icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutline16, {}),
						anchor: triggerRef.current?.closest("[data-composer-card]") ?? null,
						onDone: () => {
							setToast(null);
						}
					}, toast.seq)
				]
			});
		}
		//#endregion
		//#region src/client/picker/PickerDirectory.ts
		function pickerDirectoryView(snapshot, operations) {
			return {
				snapshot,
				getDirectorySnapshot: operations.getDirectorySnapshot,
				load: operations.load,
				select: operations.select
			};
		}
		/** Directory view whose groups follow the shared LLM Providers card order. */
		function pickerDirectoryViewOrdered(snapshot, operations, order) {
			return pickerDirectoryView({
				...snapshot,
				groups: sortCatalogGroups(snapshot.groups, order)
			}, operations);
		}
		//#endregion
		//#region src/client/picker/RetryBoundary.tsx
		/** Own retryable React error-boundary state while callers own presentation and copy. */
		var RetryBoundary = class extends react.Component {
			state = { message: null };
			static getDerivedStateFromError(error) {
				return { message: error instanceof Error ? error.message : String(error) };
			}
			componentDidCatch(error, info) {
				console.error(this.props.logLabel, error, info);
			}
			render() {
				if (this.state.message === null) return this.props.children;
				return this.props.renderFallback(this.state.message, () => {
					this.setState({ message: null });
				});
			}
		};
		//#endregion
		//#region \0dsh-css:src/client/picker/PlanReviewCard.module.css.mjs
		const css = ".BylfoW_frame{padding:6px calc(var(--dsh-composer-side-clearance) + 16px) 10px;justify-content:center;display:flex}.BylfoW_card{width:100%;max-width:var(--dsh-chat-content-width);border:1px solid var(--dsw-alias-state-warn-secondary);background:var(--dsw-specific-input-major);max-height:min(60vh,520px);box-shadow:var(--dsw-shadow-lv2);color:var(--dsw-alias-label-primary);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border-radius:20px;flex-direction:column;display:flex;overflow:visible}.BylfoW_card,.BylfoW_card *{box-sizing:border-box}.BylfoW_strip{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-primary);border-radius:20px 20px 0 0;flex-shrink:0;align-items:center;gap:8px;padding:10px 16px;font-size:13px;line-height:18px;display:flex}.BylfoW_dot{background:var(--dsw-alias-state-warn-primary);border-radius:50%;width:8px;height:8px}.BylfoW_stripTitle{flex:none;font-weight:600}.BylfoW_headerPicker{flex:0 auto;align-items:center;min-width:0;max-width:55%;margin-left:auto;display:flex}.BylfoW_headerPicker>*{min-width:0;max-width:100%}.BylfoW_body{overscroll-behavior:contain;flex:auto;min-height:0;padding:12px 16px 4px;font-size:14px;line-height:22px;overflow-y:auto}.BylfoW_footer{z-index:2;flex-direction:column;flex-shrink:0;gap:6px;padding:8px 16px 12px;display:flex;position:relative;overflow:visible}.BylfoW_feedback{min-height:0;color:var(--dsw-alias-state-error-primary);font-size:11px;line-height:16px}.BylfoW_feedback:empty{display:none}.BylfoW_bar{flex-wrap:nowrap;justify-content:space-between;align-items:center;gap:12px;min-width:0;min-height:32px;display:flex}.BylfoW_picker{flex:16rem;min-width:0;max-width:16rem}.BylfoW_pickerError{color:var(--dsw-alias-state-error-primary);overflow-wrap:anywhere;flex-wrap:wrap;align-items:center;gap:6px;font-size:12px;display:flex}.BylfoW_actions{flex-wrap:nowrap;flex:none;justify-content:flex-end;align-items:center;gap:8px;margin-left:auto;display:flex}.BylfoW_discuss,.BylfoW_keep,.BylfoW_approve{white-space:nowrap;height:32px;min-height:32px;padding:0 10px}.BylfoW_discuss{color:var(--dsw-alias-label-secondary)}.BylfoW_discuss:hover:not(:disabled){color:var(--dsw-alias-label-primary)}.BylfoW_approve{padding:0 12px}@media (width<=720px){.BylfoW_frame{padding-right:max(10px, env(safe-area-inset-right));padding-bottom:max(10px, env(safe-area-inset-bottom));padding-left:max(10px, env(safe-area-inset-left))}.BylfoW_card{border-radius:16px}.BylfoW_strip,.BylfoW_body,.BylfoW_footer{padding-left:12px;padding-right:12px}.BylfoW_strip{flex-wrap:wrap;gap:6px}.BylfoW_headerPicker{flex:100%;max-width:100%;margin-left:0}.BylfoW_bar{justify-content:flex-end;gap:6px}.BylfoW_actions{flex:100%;justify-content:flex-end;gap:6px;min-width:0}.BylfoW_discuss,.BylfoW_keep,.BylfoW_approve{overflow-wrap:anywhere;white-space:normal;flex:1 1 0;min-width:0;height:auto;padding:4px;line-height:14px}}";
		const tagId = "dsh-model-switch/PlanReviewCard.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-model-switch";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var PlanReviewCard_module_css_default = {
			"actions": "BylfoW_actions",
			"approve": "BylfoW_approve",
			"bar": "BylfoW_bar",
			"body": "BylfoW_body",
			"card": "BylfoW_card",
			"discuss": "BylfoW_discuss",
			"dot": "BylfoW_dot",
			"feedback": "BylfoW_feedback",
			"footer": "BylfoW_footer",
			"frame": "BylfoW_frame",
			"headerPicker": "BylfoW_headerPicker",
			"keep": "BylfoW_keep",
			"picker": "BylfoW_picker",
			"pickerError": "BylfoW_pickerError",
			"strip": "BylfoW_strip",
			"stripTitle": "BylfoW_stripTitle"
		};
		//#endregion
		//#region src/client/picker/PlanReviewCard.tsx
		function PickerGuard({ children, errorLabel, retryLabel }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RetryBoundary, {
				logLabel: "dsh-model-switch: Plan Review picker crashed",
				renderFallback: (message, retry) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					"data-dsh-ms-plan-picker-error": true,
					role: "alert",
					className: PlanReviewCard_module_css_default.pickerError,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: errorLabel(message) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						type: "button",
						variant: "outline",
						onClick: retry,
						children: retryLabel
					})]
				}),
				children
			});
		}
		async function respondAnswer(wait, id, label, rejectedMessage, terminalRejection = false) {
			try {
				await wait.answer({ answers: [{
					id,
					selected: [label]
				}] });
			} catch {
				throw new (terminalRejection ? PlanApprovalResponseError : Error)(rejectedMessage);
			}
		}
		async function respondCancel(wait, rejectedMessage) {
			try {
				await wait.cancel();
			} catch {
				throw new Error(rejectedMessage);
			}
		}
		function PlanReviewCard(props) {
			const snapshot = props.useDirectory((value) => value);
			const order = props.useProviderOrder((value) => value);
			const providerLock = props.useConversation((snapshot) => snapshot.views.get("model-switch.runtime-lock") ?? null);
			const review = planReviewOf(props.matched.questions);
			if (review === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: PlanReviewCard_module_css_default.frame,
				"data-plan-review-key": props.matched.key,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
					className: PlanReviewCard_module_css_default.card,
					"aria-label": props.t("plan.header"),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: PlanReviewCard_module_css_default.strip,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: PlanReviewCard_module_css_default.dot }), props.t("plan.header")]
					})
				})
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PlanReviewState, {
				matched: props.matched,
				review,
				available: props.available,
				providerLock,
				directory: pickerDirectoryViewOrdered(snapshot, props, order),
				t: props.t,
				...props.resolveInteractionOperations === void 0 ? {} : { resolveInteractionOperations: props.resolveInteractionOperations }
			}, props.matched.key);
		}
		function PlanReviewState({ matched, review, available, providerLock, directory, t, resolveInteractionOperations }) {
			const { snapshot, getDirectorySnapshot, load, select } = directory;
			const [execution, setExecution] = (0, react.useState)(snapshot.current ?? void 0);
			const [busy, setBusy] = (0, react.useState)(false);
			const [blocked, setBlocked] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const operationLocked = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			(0, react.useEffect)(() => {
				if (execution === void 0 && snapshot.current !== null) setExecution(snapshot.current);
			}, [execution, snapshot.current]);
			const settle = (send) => {
				if (operationLocked.current || blocked) return;
				operationLocked.current = true;
				let terminal = false;
				settlePlanAction(send, (state) => {
					terminal = state.blocked;
					setBusy(state.busy);
					setBlocked(state.blocked);
					setError(state.error);
				}).then((completed) => {
					if (!completed && !terminal) operationLocked.current = false;
				});
			};
			const executionAllowed = execution !== void 0 && providerSelectable(providerLock, execution.provider);
			const action = planActionView({
				busy,
				blocked,
				error
			}, available, executionAllowed);
			const onApprove = () => {
				if (execution === void 0 || !executionAllowed || !available || busy || blocked) return;
				settle(async () => {
					if (!await approvePlanReview({
						select,
						selection: execution,
						current: snapshot.current,
						answer: () => respondAnswer(matched, review.id, review.approve.label, t("plan.responseRejected"), true)
					})) {
						const message = getDirectorySnapshot().error;
						throw new Error(message === null ? t("plan.modelFailed") : t("error.action", { message }));
					}
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: PlanReviewCard_module_css_default.frame,
				"data-plan-review-key": matched.key,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: PlanReviewCard_module_css_default.card,
					"aria-label": review.question,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: PlanReviewCard_module_css_default.strip,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: PlanReviewCard_module_css_default.dot }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: PlanReviewCard_module_css_default.stripTitle,
									children: t("plan.header")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: PlanReviewCard_module_css_default.headerPicker,
									"aria-label": t("plan.execution"),
									onPointerDown: (event) => {
										event.stopPropagation();
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PickerGuard, {
										errorLabel: (message) => t("plan.pickerCrash", { message }),
										retryLabel: t("retry"),
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ComposerPicker, {
											locked: busy || blocked,
											providerLock,
											available,
											directory,
											t,
											...resolveInteractionOperations === void 0 ? {} : { resolveInteractionOperations },
											...execution === void 0 ? {} : { draft: execution },
											onDraftChange: setExecution,
											embedded: true,
											tone: "capsule"
										})
									})
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: PlanReviewCard_module_css_default.body,
							"data-plan-review-scroll": true,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, {
								text: review.plan,
								labels: {
									code: {
										copyLabel: t("markdown.copy"),
										copiedLabel: t("markdown.copied")
									},
									footnotes: t("markdown.footnotes")
								}
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: PlanReviewCard_module_css_default.footer,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: PlanReviewCard_module_css_default.feedback,
								role: "status",
								children: action.error
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: PlanReviewCard_module_css_default.bar,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: PlanReviewCard_module_css_default.actions,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "ghost",
											className: PlanReviewCard_module_css_default.discuss,
											icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutline16, { size: 14 }),
											disabled: busy || blocked,
											onClick: () => {
												settle(() => respondCancel(matched, t("plan.cancelRejected")));
											},
											children: t("plan.discuss")
										}),
										review.decline !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "outline",
											className: PlanReviewCard_module_css_default.keep,
											disabled: busy || blocked,
											title: review.decline.description ?? t("plan.keep"),
											onClick: () => {
												settle(() => respondAnswer(matched, review.id, review.decline.label, t("plan.responseRejected")));
											},
											children: t("plan.keep")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "primary",
											className: PlanReviewCard_module_css_default.approve,
											disabled: action.approveDisabled,
											onClick: onApprove,
											children: t("plan.approve")
										})
									]
								})
							})]
						})
					]
				})
			});
		}
		//#endregion
		//#region src/client/picker/PickerSeatBoundary.tsx
		function PickerSeatBoundary({ children, errorLabel }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RetryBoundary, {
				logLabel: "dsh-model-switch: composer picker seat crashed",
				renderFallback: (message, retry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					"data-dsh-ms-seat-error": true,
					title: message,
					onClick: retry,
					style: {
						maxWidth: 280,
						border: 0,
						background: "transparent",
						color: "var(--dsw-alias-state-error-primary)",
						font: "var(--dsw-font-xs-13)",
						overflowWrap: "anywhere",
						cursor: "pointer"
					},
					children: errorLabel(message)
				}),
				children
			});
		}
		//#endregion
		//#region src/client/picker/locales.ts
		/** `composer-picker` namespace dictionaries. */
		const zh = {
			"trigger.fallback": "选择模型",
			"trigger.selectAria": "选择模型",
			"trigger.aria": "选择模型，当前 {model}",
			"trigger.ariaEffort": "选择模型，当前 {model}，推理等级 {effort}",
			"menu.aria": "模型档位",
			"menu.back": "返回模型设置",
			"menu.closeSearch": "关闭搜索",
			"menu.model": "模型",
			"menu.effort": "推理等级",
			"menu.context": "上下文",
			"menu.fast": "Fast",
			"menu.thinking": "思考",
			"menu.search": "搜索模型",
			"context.standard": "标准",
			"fast.on": "开",
			"fast.off": "关",
			"thinking.on": "开",
			"thinking.off": "关",
			"effort.providerDefault": "Default",
			"status.loading": "正在刷新模型列表…",
			"error.action": "模型操作失败：{message}",
			"error.picker": "模型选择器出错：{message}（点击重试）",
			"action.reload": "重新加载",
			"retry": "重试",
			"warning.groupLoad": "{name} 加载失败：{message}",
			"empty.models": "没有可用的模型。",
			"empty.efforts": "当前模型未提供推理等级。",
			"plan.kicker": "Plan",
			"plan.header": "计划待审",
			"plan.execution": "执行模型",
			"plan.approve": "确认执行",
			"plan.keep": "拒绝",
			"plan.discuss": "去聊天里说",
			"plan.modelFailed": "切换执行模型失败；计划尚未批准，可以重试。",
			"plan.pickerCrash": "执行模型选择器出错：{message}",
			"plan.responseRejected": "计划答复已被另一客户端处理；已提交的模型切换无法由插件回滚。",
			"plan.cancelRejected": "计划审查已被另一客户端处理，无法返回讨论。",
			"markdown.copy": "复制代码",
			"markdown.copied": "已复制",
			"markdown.footnotes": "脚注"
		};
		const en = {
			"trigger.fallback": "Select model",
			"trigger.selectAria": "Select model",
			"trigger.aria": "Select model, current {model}",
			"trigger.ariaEffort": "Select model, current {model}, reasoning effort {effort}",
			"menu.aria": "Model options",
			"menu.back": "Back to model settings",
			"menu.closeSearch": "Close search",
			"menu.model": "Model",
			"menu.effort": "Effort",
			"menu.context": "Context",
			"menu.fast": "Fast",
			"menu.thinking": "Thinking",
			"menu.search": "Search models",
			"context.standard": "Standard",
			"fast.on": "On",
			"fast.off": "Off",
			"thinking.on": "On",
			"thinking.off": "Off",
			"effort.providerDefault": "Default",
			"status.loading": "Refreshing model list…",
			"error.action": "Model operation failed: {message}",
			"error.picker": "Model picker error: {message} (click to retry)",
			"action.reload": "Reload",
			"retry": "Retry",
			"warning.groupLoad": "{name} failed to load: {message}",
			"empty.models": "No models available.",
			"empty.efforts": "This model provides no reasoning effort levels.",
			"plan.kicker": "Plan",
			"plan.header": "Plan review",
			"plan.execution": "Execution model",
			"plan.approve": "Approve",
			"plan.keep": "Keep planning",
			"plan.discuss": "Discuss",
			"plan.modelFailed": "Could not switch the execution model; the Plan is still pending and can be retried.",
			"plan.pickerCrash": "Execution model picker error: {message}",
			"plan.responseRejected": "Another client already handled this Plan response. A committed model change cannot be rolled back by this plugin.",
			"plan.cancelRejected": "Another client already handled this Plan review, so it cannot return to discussion.",
			"markdown.copy": "Copy code",
			"markdown.copied": "Copied",
			"markdown.footnotes": "Footnotes"
		};
		//#endregion
		//#region src/client/picker/install.tsx
		const NS = "composer-picker";
		const MODEL_PRIORITY = -10;
		const PLAN_REVIEW_PRIORITY = -5;
		function interactionOperationsFrom(ctx) {
			let value;
			try {
				value = ctx.get("interactionOperations", false);
			} catch {
				return;
			}
			if (value === null || typeof value !== "object") return void 0;
			const candidate = value;
			return typeof candidate.registerSurface === "function" ? candidate : void 0;
		}
		const EMPTY_ORDER = [];
		function providerOrderStore(settingsScope) {
			let bound;
			try {
				bound = settingsScope.bind({
					namespace: PROVIDERS_SETTINGS_NS,
					decode: decodeProviderOrder
				});
			} catch {
				bound = void 0;
			}
			let last = EMPTY_ORDER;
			return {
				subscribe: (listener) => bound?.subscribe(listener) ?? (() => {}),
				getSnapshot: () => {
					const next = bound?.getSnapshot().value?.order ?? EMPTY_ORDER;
					if (next.length === last.length && next.every((key, index) => key === last[index])) return last;
					last = next;
					return last;
				}
			};
		}
		function mainDefaultOps(selection) {
			return [
				{
					op: "set",
					path: ["provider"],
					value: selection.provider
				},
				{
					op: "set",
					path: ["model"],
					value: selection.model
				},
				selection.reasoningEffort === void 0 || selection.reasoningEffort === "" ? {
					op: "unset",
					path: ["reasoningEffort"]
				} : {
					op: "set",
					path: ["reasoningEffort"],
					value: selection.reasoningEffort
				}
			];
		}
		async function restoreMainDefault(remoteSettings, before) {
			if (before.status !== "ready" || before.mode !== "host" || !before.writable || before.value === void 0 || before.revision === void 0) return;
			const response = await remoteSettings.mutate(MAIN_SETTINGS_ID, mainDefaultOps(before.value), before.revision + 1);
			if (!response.ok && response.error?.code !== "settings-conflict") throw new Error(`${response.error?.code}: ${response.error?.message}`);
		}
		function ModelSeat(props) {
			const directory = props.useDirectory((snapshot) => snapshot);
			const order = props.useProviderOrder((value) => value);
			const providerLock = props.useConversation((snapshot) => snapshot.views.get("model-switch.runtime-lock") ?? null);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ComposerPicker, {
				locked: props.locked,
				providerLock,
				available: props.available,
				directory: pickerDirectoryViewOrdered(directory, props, order),
				t: props.t,
				...props.resolveInteractionOperations === void 0 ? {} : { resolveInteractionOperations: props.resolveInteractionOperations }
			});
		}
		function ModelSeatEntry(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PickerSeatBoundary, {
				errorLabel: (message) => props.t("error.picker", { message }),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelSeat, { ...props })
			});
		}
		/** Register composer model picker and Plan Review execution picker. */
		function installComposerPicker(ctx) {
			installAntigravityRuntimeLock(ctx);
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-model-switch: composer picker dictionaries");
			ctx.inject([
				"slots",
				"modelDirectories",
				"settingsScope",
				"remote.settings"
			], (scope) => {
				const models = scope.modelDirectories;
				const sessions = scope.sessions;
				const mainDefaults = scope.settingsScope.bind({
					namespace: MAIN_SETTINGS_ID,
					decode: decodeMainSettings
				});
				const orderStore = providerOrderStore(scope.settingsScope);
				const remoteSettings = scope.remote.settings;
				const resolveInteractionOperations = () => interactionOperationsFrom(scope);
				const directoryFace = (sessionId) => {
					const directory = models.directoryFor(sessionId);
					const available = sessions?.subagentAddress?.(sessionId) === void 0;
					return {
						available,
						hooks: {
							directory: directory.store,
							providerOrder: orderStore
						},
						getDirectorySnapshot: directory.store.getSnapshot,
						resolveInteractionOperations,
						load: () => {
							if (available) directory.load().catch(() => {});
						},
						select: async (selection) => {
							if (!available) return false;
							const defaultBeforeSwitch = mainDefaults.getSnapshot();
							try {
								await directory.select(selection);
								await restoreMainDefault(remoteSettings, defaultBeforeSwitch);
								return true;
							} catch {
								return false;
							}
						}
					};
				};
				scope.slots.inject("conversation.input.model", () => scope.slots.register({
					name: "conversation.input.model",
					locale: NS,
					priority: MODEL_PRIORITY,
					inject: directoryFace
				}, ModelSeatEntry));
				scope.slots.inject("conversation.composer", () => scope.slots.register({
					name: "conversation.composer",
					locale: NS,
					priority: PLAN_REVIEW_PRIORITY,
					select: (owner) => selectPlanReview(owner),
					inject: directoryFace
				}, PlanReviewCard));
			});
		}
		//#endregion
		//#region src/client/nav-icon.ts
		/** Official settings.section has no icon field. Swap the default gear for a model-switch glyph. */
		const LABELS = /* @__PURE__ */ new Set(["Model Switch", "模型切换"]);
		const MARK = "data-dsh-ms-icon";
		const GLYPH = [
			"<g data-dsh-ms-glyph=\"switch\">",
			"<path d=\"M3 5.5h7.2\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\"/>",
			"<path d=\"M10.2 5.5 8.4 3.7M10.2 5.5 8.4 7.3\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
			"<path d=\"M13 10.5H5.8\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\"/>",
			"<path d=\"M5.8 10.5 7.6 8.7M5.8 10.5 7.6 12.3\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
			"</g>"
		].join("");
		function patch() {
			for (const button of Array.from(document.querySelectorAll("nav button"))) {
				if (Array.from(button.querySelectorAll("span")).find((span) => LABELS.has(span.textContent?.trim() ?? "")) === void 0) continue;
				const svg = button.querySelector("svg");
				if (svg === null) continue;
				if (svg.getAttribute(MARK) === "switch" && svg.innerHTML.includes("data-dsh-ms-glyph=\"switch\"")) continue;
				svg.setAttribute(MARK, "switch");
				svg.setAttribute("viewBox", "0 0 16 16");
				svg.setAttribute("fill", "none");
				svg.innerHTML = GLYPH;
			}
		}
		function touchesSettingsNav(node) {
			if (!(node instanceof Element)) return false;
			if (node.closest("nav") !== null || node.querySelector("nav") !== null) return true;
			const buttons = node.matches("button") ? [node, ...Array.from(node.querySelectorAll("button"))] : Array.from(node.querySelectorAll("button"));
			for (const button of buttons) for (const span of Array.from(button.querySelectorAll("span"))) if (LABELS.has(span.textContent?.trim() ?? "")) return true;
			return false;
		}
		/** Keep the Model Switch nav glyph in place across Settings re-renders. */
		function installModelSwitchNavIcon() {
			if (typeof document === "undefined" || document.body === null) return () => {};
			let frame = 0;
			const observer = new MutationObserver((records) => {
				if (!records.some((record) => touchesSettingsNav(record.target) || Array.from(record.addedNodes).some(touchesSettingsNav))) return;
				if (frame !== 0) return;
				frame = requestAnimationFrame(() => {
					frame = 0;
					patch();
					observer.takeRecords();
				});
			});
			observer.observe(document.body, {
				childList: true,
				subtree: true
			});
			patch();
			observer.takeRecords();
			return () => {
				observer.disconnect();
				if (frame !== 0) cancelAnimationFrame(frame);
			};
		}
		//#endregion
		//#region src/client/index.tsx
		const name = "dsh-model-switch-client";
		const inject = [
			"slots",
			"locale",
			"sessions",
			"modelDirectories",
			"settingsScope",
			"remote",
			"remote.settings",
			"remote.session"
		];
		function apply(ctx) {
			installComposerPicker(ctx);
			ctx.effect(installModelSwitchNavIcon, "dsh-model-switch: settings nav icon");
			const localeNamespace = "settings.model-switch";
			ctx.effect(() => ctx.locale.register(localeNamespace, {
				zh: zh$1,
				en: en$1
			}), "dsh-model-switch: localized Settings section");
			const t = ctx.locale.bind(localeNamespace);
			const remote = ctx.remote;
			const remoteSettings = remote.settings;
			const main = new RemoteSettingsScope(remoteSettings, MAIN_SETTINGS_ID, decodeMainSettings);
			const owned = new RemoteSettingsScope(remoteSettings, MODEL_SWITCH_SETTINGS_ID, decodeModelSwitchSettings);
			Promise.all([main.reload(), owned.reload()]);
			ctx.effect(() => remote.$on?.("settings/document-updated", () => {
				main.reload();
				owned.reload();
			}) ?? (() => {}), "dsh-model-switch: refresh Remote settings");
			const subagent = deriveSettingsScope(owned, deriveSubagentSettings, SUBAGENT_SETTINGS_FIELDS);
			const search = deriveSettingsScope(owned, deriveSearchSettings, SEARCH_SETTINGS_FIELDS);
			const image = deriveSettingsScope(owned, deriveImageSettings, IMAGE_SETTINGS_FIELDS);
			const saveMain = async (next, expectedRevision) => {
				const result = await remoteSettings.mutate(MAIN_SETTINGS_ID, [
					{
						op: "set",
						path: ["provider"],
						value: next.provider
					},
					{
						op: "set",
						path: ["model"],
						value: next.model
					},
					next.reasoningEffort === void 0 || next.reasoningEffort === "" ? {
						op: "unset",
						path: ["reasoningEffort"]
					} : {
						op: "set",
						path: ["reasoningEffort"],
						value: next.reasoningEffort
					}
				], expectedRevision);
				if (!result.ok) {
					const code = result.error?.code ?? "settings-error";
					if (code === "settings-conflict") throw new MainSettingsConflictError(t("conflict"));
					throw new Error(code + ": " + (result.error?.message ?? ""));
				}
				await main.reload();
				return result.value?.revision ?? expectedRevision;
			};
			const connectionRpc = (() => {
				try {
					const rpc = ctx.get("connection", false)?.rpc;
					return rpc !== null && (typeof rpc === "object" || typeof rpc === "function") && typeof rpc.call === "function" ? rpc : void 0;
				} catch {
					return;
				}
			})();
			const providerRoleOf = (() => {
				let directory;
				try {
					directory = ctx.get("providerDirectory", false);
				} catch {
					return;
				}
				if (directory === void 0) return void 0;
				return (key) => readProviderRole(directory, key) ?? "llm";
			})();
			let subscribeProviderOrder;
			try {
				const orderScope = ctx.settingsScope.bind({
					namespace: PROVIDERS_SETTINGS_NS,
					decode: decodeProviderOrder
				});
				subscribeProviderOrder = (listener) => orderScope.subscribe(listener);
			} catch {
				subscribeProviderOrder = void 0;
			}
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "model-switch",
				order: 9,
				label: () => t("nav"),
				locale: localeNamespace,
				inject: () => ({
					t,
					hooks: {
						mainSettings: main,
						subagentSettings: subagent,
						searchSettings: search,
						imageSettings: image
					},
					capabilities: RUNTIME_CAPABILITIES,
					saveMain,
					setSubagent: (field, value) => value === void 0 ? subagent.unset(field) : subagent.set(field, value),
					setCapability: (route, field, value) => {
						const scope = route === "search" ? search : image;
						return value === void 0 ? scope.unset(field) : scope.set(field, value);
					},
					...providerRoleOf === void 0 ? {} : { providerRoleOf },
					loadCatalog: async () => {
						const response = await ctx.remote.session.modelCatalog();
						if (!response.ok || response.value === void 0) throw new Error(t("catalogFailed"));
						const enabled = await fetchAntigravityCatalogGroups(connectionRpc);
						let order = [];
						try {
							order = ctx.settingsScope.bind({
								namespace: "llm-providers",
								decode: decodeProviderOrder
							}).getSnapshot().value?.order ?? [];
						} catch {
							order = [];
						}
						return sortCatalogGroups(withAntigravityCatalog(response.value.groups, enabled), order);
					},
					...connectionRpc === void 0 ? {} : { loadCapabilities: async (revision, signal) => {
						const rpc = connectionRpc;
						if (rpc === void 0) throw new Error(t("catalogFailed"));
						const response = await rpc.call("/model-switch", "capabilities", revision === void 0 ? {} : { revision }, signal);
						if (!response.ok || response.value === void 0) throw new Error(t("catalogFailed"));
						const snapshot = decodeCapabilitiesSnapshot(response.value);
						if (snapshot === void 0) throw new Error(t("catalogFailed"));
						return snapshot;
					} },
					...subscribeProviderOrder === void 0 ? {} : { subscribeProviderOrder }
				})
			}, ModelSwitchSettings));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
