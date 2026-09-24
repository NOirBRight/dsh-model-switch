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
		const MODEL_SWITCH_CONFIG_ID = "model-switch";
		const MAIN_DEFAULT_CONFIG_ID = "agent-default-model";
		const PROVIDERS_CONFIG_ID = "llm-providers-ui";
		var MainSettingsConflictError = class extends Error {
			name = "MainSettingsConflictError";
		};
		const SUBAGENT_SETTINGS_FIELDS = Object.freeze({
			mode: "subagentMode",
			provider: "subagentProvider",
			model: "subagentModel",
			reasoningEffort: "subagentReasoningEffort"
		});
		/** Instant Subagent header toggle. Off keeps the stored `follow-main` unset token. */
		function subagentModeForEnabled(enabled) {
			return enabled ? "fixed" : "follow-main";
		}
		const SEARCH_SETTINGS_FIELDS = Object.freeze({
			provider: "searchProvider",
			model: "searchModel"
		});
		const IMAGE_SETTINGS_FIELDS = Object.freeze({
			provider: "imageProvider",
			model: "imageModel"
		});
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
		//#region src/client/derived-config-form.ts
		function deriveConfigForm(source, project, fields) {
			let sourceSnapshot;
			let viewSnapshot;
			const getSnapshot = () => {
				const current = source.getSnapshot();
				if (current === sourceSnapshot && viewSnapshot !== void 0) return viewSnapshot;
				sourceSnapshot = current;
				const next = {
					...current,
					value: current.value === void 0 ? void 0 : project(current.value)
				};
				viewSnapshot = next;
				return next;
			};
			const write = async (operation, field, value) => {
				const sourceField = fields[field];
				if (!(operation === "set" ? await source.set(sourceField, value) : await source.unset(sourceField))) throw new Error("settings-rejected");
			};
			return {
				getSnapshot,
				subscribe: (listener) => source.subscribe(listener),
				set: (field, value) => write("set", field, value),
				unset: (field) => write("unset", field)
			};
		}
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
		//#region src/client/plugin-rpc.ts
		function callPluginRpc(rpc, method, endpoint, payload, signal) {
			return rpc.call("/api", method, {
				endpoint,
				payload
			}, signal);
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
		/** Agent role owned by ProviderDirectory (dsh-llm-providers-ui), never hardcoded by Model Switch. */
		const AGENT_ROLE = "agent";
		/**
		* Antigravity's authenticated plugin route; this plugin has no build dependency on its owner.
		*/
		const ANTIGRAVITY_CATALOG_METHOD = "plugin-rpc/antigravity";
		const ANTIGRAVITY_CATALOG_ENDPOINT = "catalog";
		function record(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
		}
		/** Retain supported effort choices from the remote catalog. */
		function decodeReasoning(value) {
			const item = record(value);
			if (item === void 0 || !Array.isArray(item.efforts)) return void 0;
			const efforts = [];
			for (const entry of item.efforts) {
				const effort = record(entry);
				if (effort === void 0 || typeof effort.id !== "string" || typeof effort.name !== "string") continue;
				efforts.push({
					id: effort.id,
					name: effort.name
				});
			}
			if (efforts.length === 0) return void 0;
			return {
				efforts,
				defaultEffort: typeof item.defaultEffort === "string" && efforts.some((effort) => effort.id === item.defaultEffort) ? item.defaultEffort : efforts[0].id
			};
		}
		const NATIVE_EFFORTS = [
			"high",
			"medium",
			"low"
		];
		function collapseNativeEfforts(models) {
			if (models.some((model) => model.reasoning !== void 0)) return models;
			const groups = /* @__PURE__ */ new Map();
			const order = [];
			for (const model of models) {
				let logical = model.id;
				let effort;
				for (const item of NATIVE_EFFORTS) {
					const suffix = "-" + item;
					if (model.id.endsWith(suffix) && model.id.length > suffix.length) {
						logical = model.id.slice(0, -suffix.length);
						effort = item;
						break;
					}
				}
				let group = groups.get(logical);
				if (group === void 0) {
					let name = model.name;
					for (const label of [
						" (High)",
						" (Medium)",
						" (Low)"
					]) if (name.endsWith(label)) name = name.slice(0, -label.length);
					group = {
						name,
						efforts: []
					};
					groups.set(logical, group);
					order.push(logical);
				}
				if (effort !== void 0 && !group.efforts.includes(effort)) group.efforts.push(effort);
				if (effort === void 0) group.name = model.name;
			}
			return order.map((id) => {
				const group = groups.get(id);
				const efforts = NATIVE_EFFORTS.filter((item) => group.efforts.includes(item)).map((item) => ({
					id: item,
					name: item[0].toUpperCase() + item.slice(1)
				}));
				return {
					id,
					name: group.name,
					...efforts.length === 0 ? {} : { reasoning: {
						efforts,
						defaultEffort: group.efforts.includes("high") ? "high" : efforts[0].id
					} }
				};
			});
		}
		/** Strictly decode one Enabled-catalog group; malformed groups are dropped, never thrown. */
		function decodeGroup(value) {
			const group = record(value);
			if (group === void 0 || typeof group.id !== "string" || typeof group.name !== "string" || !Array.isArray(group.models)) return void 0;
			const models = [];
			for (const item of group.models) {
				const model = record(item);
				if (model === void 0 || typeof model.id !== "string" || typeof model.name !== "string") continue;
				const reasoning = decodeReasoning(model.reasoning);
				models.push({
					id: model.id,
					name: model.name,
					...reasoning === void 0 ? {} : { reasoning }
				});
			}
			if (models.length === 0) return void 0;
			return {
				id: group.id,
				name: group.name,
				models: collapseNativeEfforts(models)
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
				const result = await callPluginRpc(rpc, ANTIGRAVITY_CATALOG_METHOD, ANTIGRAVITY_CATALOG_ENDPOINT, {});
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
			const catalogRoutes = directory.catalogRoutes;
			const routes = typeof catalogRoutes === "function" ? catalogRoutes.call(directory) : void 0;
			const role = roleOf.call(directory, routes?.[key] ?? key);
			return typeof role === "string" ? role : void 0;
		}
		/** Whether a ProviderDirectory-owned role marks an Agent provider. */
		function isAgentRole(role) {
			return role === AGENT_ROLE;
		}
		/** Resolve a stored native `…-high|medium|low` id to the collapsed catalog row. */
		function matchCatalogModel(models, modelId) {
			if (modelId === void 0) return void 0;
			const exact = models.find((model) => model.id === modelId);
			if (exact !== void 0) return { model: exact };
			for (const effort of NATIVE_EFFORTS) {
				const suffix = "-" + effort;
				if (!modelId.endsWith(suffix) || modelId.length <= suffix.length) continue;
				const logical = models.find((model) => model.id === modelId.slice(0, -suffix.length));
				if (logical?.reasoning?.efforts.some((option) => option.id === effort)) return {
					model: logical,
					effort
				};
			}
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
		const css$2 = ".djvrPG_section{max-width:720px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:12px;display:flex;container-type:inline-size}.djvrPG_title{margin:0;font-size:16px;font-weight:500;line-height:24px}.djvrPG_intro{color:var(--dsw-alias-label-tertiary);margin:0;font-size:14px;line-height:22px}.djvrPG_saved{color:var(--dsw-alias-state-success-primary);align-items:center;gap:6px;margin:0;font-size:12px;line-height:18px;display:flex}.djvrPG_savedDot{background:currentColor;border-radius:50%;width:7px;height:7px}.djvrPG_group{flex-direction:column;gap:8px;margin-top:8px;display:flex}.djvrPG_groupLabel{color:var(--dsw-alias-label-tertiary);margin:0 2px;font-size:12px;font-weight:500;line-height:18px}.djvrPG_routeCard{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-module-platform);border-radius:10px;list-style:none;overflow:hidden}.djvrPG_routeCardUnavailable{opacity:.72}.djvrPG_routeHeader{width:100%;min-height:68px;color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;justify-content:space-between;align-items:center;gap:16px;padding:12px 14px;display:flex}.djvrPG_routeHeader:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.djvrPG_routeHeader:disabled{cursor:default}.djvrPG_routeIcon{width:18px;height:18px;color:var(--dsw-alias-label-primary);flex:none;display:block}.djvrPG_routeCopy{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.djvrPG_routeName{color:var(--dsw-alias-label-primary);align-items:center;gap:8px;font-size:14px;font-weight:600;line-height:20px;display:flex}.djvrPG_routeSummary{color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;font-size:13px;line-height:18px;overflow:hidden}.djvrPG_badge{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;flex:none;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.djvrPG_badgeWarn{color:var(--dsw-alias-state-warn-label)}.djvrPG_chevron{width:18px;height:18px;color:var(--dsw-alias-label-primary);flex:none;transition:transform .16s}.djvrPG_routeCardOpen .djvrPG_chevron{transform:rotate(180deg)}.djvrPG_cardBody{border-top:1px solid var(--dsw-alias-border-l2);padding:16px 14px 18px}.djvrPG_formGrid{grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;display:grid}.djvrPG_field{flex-direction:column;gap:6px;min-width:0;display:flex}.djvrPG_fieldFull{grid-column:1/-1}.djvrPG_fieldLabel{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500;line-height:18px}.djvrPG_input{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);appearance:none;background-color:var(--dsw-alias-bg-layer-1);width:100%;height:32px;color:var(--dsw-alias-label-primary);font:inherit;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2381858C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\");background-position:right 10px center;background-repeat:no-repeat;border-radius:8px;padding:0 32px 0 10px;font-size:14px;line-height:22px}.djvrPG_textInput{background-image:none;padding-right:10px}.djvrPG_input:focus{border-color:var(--dsw-alias-brand-primary);outline:none}.djvrPG_input:disabled{opacity:.6;cursor:default}.djvrPG_hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:18px}.djvrPG_warning{color:var(--dsw-alias-state-warn-label)}.djvrPG_message{flex:1;min-width:0}.djvrPG_cardFooter{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;margin-top:14px;padding:12px 0 0;display:flex}.djvrPG_button{box-sizing:border-box;height:36px;font:inherit;cursor:pointer;border-radius:18px;justify-content:center;align-items:center;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex}.djvrPG_secondaryButton{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);background:0 0}.djvrPG_secondaryButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid)}.djvrPG_primaryButton{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);border:0}.djvrPG_primaryButton:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}.djvrPG_button:disabled{opacity:.4;cursor:default}.djvrPG_button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}@container (width<=420px){.djvrPG_formGrid{grid-template-columns:1fr}.djvrPG_cardFooter .djvrPG_button{flex:1}}.djvrPG_routeHeaderRow{align-items:center;gap:8px;padding-right:14px;display:flex}.djvrPG_routeHeaderRow .djvrPG_routeHeader{flex:1;min-width:0}.djvrPG_rowCard{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-module-platform);border-radius:10px;align-items:flex-start;gap:16px;padding:14px 16px;display:flex}.djvrPG_rowCopy{flex:1;gap:4px;min-width:0;display:grid}.djvrPG_rowTitle{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600;line-height:20px}.djvrPG_switch{background:var(--dsw-alias-bg-layer-1);width:40px;height:24px;box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l2);cursor:pointer;border:0;border-radius:999px;flex:none;padding:0;position:relative}.djvrPG_switchOn{background:var(--dsw-alias-button-primary-fill);box-shadow:none}.djvrPG_switch i{background:var(--dsw-alias-label-primary-foreground);pointer-events:none;border-radius:50%;width:18px;height:18px;transition:left .16s;position:absolute;top:3px;left:3px}.djvrPG_switchOn i{left:19px}.djvrPG_switch:disabled{opacity:.4;cursor:default}.djvrPG_switch:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}@media (prefers-reduced-motion:reduce){.djvrPG_chevron,.djvrPG_switch i{transition:none}}";
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
			"routeHeaderRow": "djvrPG_routeHeaderRow",
			"routeIcon": "djvrPG_routeIcon",
			"routeName": "djvrPG_routeName",
			"routeSummary": "djvrPG_routeSummary",
			"rowCard": "djvrPG_rowCard",
			"rowCopy": "djvrPG_rowCopy",
			"rowTitle": "djvrPG_rowTitle",
			"saved": "djvrPG_saved",
			"savedDot": "djvrPG_savedDot",
			"secondaryButton": "djvrPG_secondaryButton",
			"section": "djvrPG_section",
			"switch": "djvrPG_switch",
			"switchOn": "djvrPG_switchOn",
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
		function RouteCard({ title, summary, hint, icon, open, onToggle, disabled = false, badge, badgeWarn = false, trailing, expandable = true, children }) {
			const header = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: ModelSwitchSettings_module_css_default.routeHeader,
				disabled,
				"aria-expanded": disabled || !expandable ? void 0 : open,
				onClick: onToggle,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: ModelSwitchSettings_module_css_default.routeIcon,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RouteIcon, { kind: icon })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: ModelSwitchSettings_module_css_default.routeCopy,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: ModelSwitchSettings_module_css_default.routeName,
								children: [title, badge === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {
									className: cx(ModelSwitchSettings_module_css_default.badge, badgeWarn && ModelSwitchSettings_module_css_default.badgeWarn),
									children: badge
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ModelSwitchSettings_module_css_default.routeSummary,
								children: summary
							}),
							hint === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ModelSwitchSettings_module_css_default.hint,
								children: hint
							})
						]
					}),
					disabled || !expandable ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
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
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
				className: cx(ModelSwitchSettings_module_css_default.routeCard, open && ModelSwitchSettings_module_css_default.routeCardOpen, disabled && ModelSwitchSettings_module_css_default.routeCardUnavailable),
				children: [trailing === void 0 ? header : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: ModelSwitchSettings_module_css_default.routeHeaderRow,
					children: [header, trailing]
				}), open && !disabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: ModelSwitchSettings_module_css_default.cardBody,
					children
				}) : null]
			});
		}
		function InstantSwitch({ checked, disabled, label, onChange }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: cx(ModelSwitchSettings_module_css_default.switch, checked && ModelSwitchSettings_module_css_default.switchOn),
				role: "switch",
				"aria-checked": checked,
				"aria-label": label,
				disabled,
				onClick: () => {
					if (!disabled) onChange(!checked);
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {})
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
			const model = matchCatalogModel(provider?.models ?? [], route.model)?.model;
			return compact(provider?.name ?? route.provider, model?.name ?? route.model);
		}
		function routeDefaultEffort(groups, route) {
			if (route === void 0) return void 0;
			const matched = matchCatalogModel(groups.find((group) => group.id === route.provider)?.models ?? [], route.model);
			return matched?.effort ?? matched?.model.reasoning?.defaultEffort;
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
			const switchSettings = props.useSwitchSettings((value) => value);
			const [open, setOpen] = (0, react.useState)();
			const [subagentDraft, setSubagentDraft, resetSubagent] = useDraft(subagent);
			const [searchDraft, setSearchDraft, resetSearch] = useDraft(search);
			const [imageDraft, setImageDraft, resetImage] = useDraft(image);
			const [busy, setBusy] = (0, react.useState)();
			const [message, setMessage] = (0, react.useState)();
			const [compactBusy, setCompactBusy] = (0, react.useState)(false);
			const [compactError, setCompactError] = (0, react.useState)();
			const loadSearchCapabilities = props.loadCapabilities;
			const [searchSnapshot, setSearchSnapshot] = (0, react.useState)(void 0);
			const [searchError, setSearchError] = (0, react.useState)(void 0);
			(0, react.useEffect)(() => {
				if (loadSearchCapabilities === void 0) return;
				let live = true;
				const scope = new AbortController();
				let timer;
				let failures = 0;
				let signature;
				const poll = async (revision) => {
					try {
						const snapshot = await loadSearchCapabilities(revision, scope.signal);
						if (!live) return;
						const nextSignature = JSON.stringify(snapshot);
						if (signature !== nextSignature || failures > 0) {
							signature = nextSignature;
							setSearchSnapshot(snapshot);
							setSearchError(void 0);
						}
						failures = 0;
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
			const subagentCatalogModel = matchCatalogModel(groups.find((group) => group.id === subagentDraft?.provider)?.models ?? [], subagentDraft?.model);
			const subagentChoices = deriveRouteChoices(groups, subagentCatalogModel === void 0 ? subagentRoute : {
				...subagentRoute,
				model: subagentCatalogModel.model.id
			});
			const subagentEfforts = (() => {
				const efforts = (subagentCatalogModel?.model.reasoning?.efforts ?? []).map((effort) => ({
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
				if (subagentDraft === void 0 || subagentDraft.mode !== "fixed") return;
				run("subagent", async () => {
					if (subagent.value?.provider !== subagentDraft.provider) await props.setSubagent("provider", subagentDraft.provider);
					const matched = subagentCatalogModel;
					const nextModel = matched?.model.id ?? subagentDraft.model;
					const nextEffort = subagentDraft.reasoningEffort === "" ? void 0 : subagentDraft.reasoningEffort || matched?.effort;
					if (subagent.value?.model !== nextModel) await props.setSubagent("model", nextModel);
					if (subagent.value?.reasoningEffort !== nextEffort) await props.setSubagent("reasoningEffort", nextEffort);
				});
			};
			const persistSubagentEnabled = (enabled) => {
				if (subagentDraft === void 0 || busy === "subagent" || !subagent.writable) return;
				setSubagentDraft({
					...subagentDraft,
					mode: subagentModeForEnabled(enabled)
				});
				setBusy("subagent");
				setMessage(void 0);
				props.setSubagent("mode", subagentModeForEnabled(enabled)).then(() => {
					setBusy(void 0);
					setOpen((current) => enabled ? "subagent" : current === "subagent" ? void 0 : current);
				}, (error) => {
					setBusy(void 0);
					resetSubagent();
					setMessage({
						route: "subagent",
						text: error instanceof Error ? error.message : props.t("requestFailed")
					});
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
			const subagentOn = subagentDraft?.mode === "fixed";
			const subagentSummary = subagentDraft === void 0 ? props.t("loading") : subagentOn ? compact(routeName(groups, subagentRoute), isAgentRole(subagentRole) ? props.t("agentBadge") : void 0, defaultEffort === void 0 ? props.t("providerDefaultShort") : compact(props.t("providerDefaultShort"), defaultEffort)) : props.t("subagentOff");
			const subagentDisabled = subagent.status !== "ready" || !subagent.writable || subagentDraft === void 0 || busy === "subagent" || !subagentOn || (subagentDraft.provider ?? "").trim() === "" || (subagentDraft.model ?? "").trim() === "";
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
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							className: ModelSwitchSettings_module_css_default.groupLabel,
							children: props.t("sendProtection")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ModelSwitchSettings_module_css_default.rowCard,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ModelSwitchSettings_module_css_default.routeIcon,
									"aria-hidden": "true",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
										width: "18",
										height: "18",
										viewBox: "0 0 18 18",
										fill: "none",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
											d: "M4 5.5h10M4 9h7M4 12.5h5",
											stroke: "currentColor",
											strokeLinecap: "round"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
											d: "M13 11.5v3.5l2-1.6",
											stroke: "currentColor",
											strokeLinecap: "round",
											strokeLinejoin: "round"
										})]
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: ModelSwitchSettings_module_css_default.rowCopy,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: ModelSwitchSettings_module_css_default.rowTitle,
											children: props.t("compactOnSwitch")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: ModelSwitchSettings_module_css_default.hint,
											children: props.t("compactOnSwitchHelp")
										}),
										compactError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: cx(ModelSwitchSettings_module_css_default.hint, ModelSwitchSettings_module_css_default.message),
											children: compactError
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(InstantSwitch, {
									checked: switchSettings.value?.compactOnSwitch !== false,
									disabled: !switchSettings.writable || compactBusy,
									label: props.t("compactOnSwitch"),
									onChange: (value) => {
										setCompactBusy(true);
										setCompactError(void 0);
										props.setCompactOnSwitch(value).then(() => {
											setCompactBusy(false);
										}, (error) => {
											setCompactBusy(false);
											setCompactError(error instanceof Error ? error.message : props.t("requestFailed"));
										});
									}
								})
							]
						})]
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
								hint: props.t("subagentHelp"),
								icon: "subagent",
								open: open === "subagent" && subagentOn,
								onToggle: () => {
									if (subagentOn) toggle("subagent");
								},
								expandable: subagentOn,
								trailing: subagentDraft === void 0 ? void 0 : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(InstantSwitch, {
									checked: subagentOn,
									disabled: busy === "subagent" || !subagent.writable,
									label: props.t("subagent"),
									onChange: persistSubagentEnabled
								}),
								children: subagentDraft === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: ModelSwitchSettings_module_css_default.hint,
									children: props.t("loading")
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: ModelSwitchSettings_module_css_default.formGrid,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
											label: props.t("provider"),
											value: subagentDraft.provider ?? "",
											disabled: busy === "subagent" || !subagent.writable,
											choices: subagentChoices.providers,
											onChange: (provider) => {
												const first = groups.find((group) => group.id === provider)?.models[0];
												setSubagentDraft({
													mode: "fixed",
													...selectRouteModel(groups, provider, first?.id ?? subagentDraft.model ?? "")
												});
											}
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
											label: props.t("model"),
											value: subagentCatalogModel?.model.id ?? subagentDraft.model ?? "",
											disabled: busy === "subagent" || !subagent.writable,
											choices: subagentChoices.models,
											onChange: (model) => {
												setSubagentDraft({
													mode: "fixed",
													...selectRouteModel(groups, subagentDraft.provider ?? "", model)
												});
											}
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
											label: props.t("effort"),
											value: subagentDraft.reasoningEffort || subagentCatalogModel?.effort || "",
											disabled: busy === "subagent" || !subagent.writable,
											choices: subagentEfforts,
											onChange: (effort) => {
												const matched = subagentCatalogModel;
												setSubagentDraft({
													...subagentDraft,
													...matched?.model.id === void 0 ? {} : { model: matched.model.id },
													reasoningEffort: effort
												});
											}
										})
									]
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
			sendProtection: "发送保护",
			settingsSynced: "设置已同步",
			defaultBadge: "默认",
			cancel: "取消",
			compactOnSwitch: "切换时压缩",
			compactOnSwitchHelp: "发送且换了模型时，先按目标窗口检查上下文；超了就用切换前的模型压一次历史，再继续请求。只选模型、不发送，不会压缩。官方自动压缩和 /compact 不受影响。压缩会产生额外模型用量，摘要可能省略细节。",
			main: "主模型",
			provider: "提供商",
			model: "模型",
			providerDefault: "使用提供商默认值",
			providerDefaultShort: "Provider 默认",
			effort: "推理强度",
			save: "保存",
			saving: "保存中…",
			saved: "已保存",
			subagent: "子代理默认路由",
			subagentHelp: "DSH 已有官方子代理模型白名单：模型自己点名 provider/model 时以它为准。这里只在未点名时使用。",
			subagentOff: "未指定时使用官方继承",
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
			sendProtection: "Send protection",
			settingsSynced: "Settings synced",
			defaultBadge: "Default",
			cancel: "Cancel",
			compactOnSwitch: "Compact on switch",
			compactOnSwitchHelp: "When a sent message uses a new model, check the target window first. If needed, compact history with the previous model, then continue. Choosing a model does not compact. Official automatic compaction and /compact are unchanged. Compaction uses extra model quota and may omit details.",
			main: "Main model",
			provider: "Provider",
			model: "Model",
			providerDefault: "Provider default",
			providerDefaultShort: "Provider default",
			effort: "Reasoning effort",
			save: "Save",
			saving: "Saving…",
			saved: "Saved",
			subagent: "Default Subagent route",
			subagentHelp: "DSH already has an official Allowlist for child models the agent names. This default applies only when the spawn names none.",
			subagentOff: "Official inherit when unnamed",
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
		[
			"[data-provider-card]{box-sizing:border-box;width:100%;min-width:0;list-style:none;margin:0!important;border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important;overflow:visible}",
			"[data-provider-card-header]{box-sizing:border-box;width:100%;min-height:76px!important;display:flex;align-items:center;justify-content:space-between;gap:16px;border:0;padding:12px 14px!important;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer}",
			"[data-provider-body][hidden]{display:none!important}",
			"[data-provider-role-badge] svg{width:12px;height:12px}",
			"[data-provider-card-header]:hover{background:color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent)}",
			"[data-provider-body]{display:flex;flex-direction:column;gap:18px;border-top:1px solid var(--dsw-alias-border-l2);padding:16px 14px 18px}",
			"[data-provider-model]{display:flex;align-items:center;gap:9px;min-height:40px}",
			"[data-provider-quota-mini]{display:block}",
			"[data-providers-list]{display:flex;flex-direction:column}",
			"[data-providers-list] [data-sortable-row]+[data-sortable-row]{border-top:1px solid var(--dsw-alias-border-l2)}",
			"[data-providers-section]{container-type:inline-size}",
			"@media (max-width:680px){[data-provider-card-header]{min-height:106px!important;padding:17px 4px!important}[data-provider-header-main]{display:grid!important;grid-template-columns:minmax(0,1fr) auto;gap:7px 9px!important;align-items:center}[data-provider-header-identity]{grid-column:1;grid-row:1;gap:9px!important}[data-provider-header-mark]{width:25px!important;height:25px!important}[data-provider-role-badge]{margin-left:4px;font-size:9px!important}[data-provider-role-badge] svg{width:11px!important;height:11px!important}[data-provider-header-side]{grid-column:2;grid-row:1;justify-self:end}[data-provider-header-side] [data-provider-header-chevron]{width:18px}[data-provider-quota-mini]{grid-column:1;grid-row:2;width:auto!important;max-width:none!important;text-align:left;padding-left:34px!important}[data-provider-header-status]{grid-column:2;grid-row:2;width:auto!important;max-width:100px}[data-provider-model]{min-height:48px}[data-provider-model] input[type=checkbox]{width:17px;height:17px}[data-providers-section] button,[data-provider-card] button{min-height:44px}}",
			"@container (max-width:540px){[data-provider-card-header]{min-height:106px!important;padding:17px 4px!important}[data-provider-header-main]{display:grid!important;grid-template-columns:minmax(0,1fr) auto;gap:7px 9px!important;align-items:center}[data-provider-header-identity]{grid-column:1;grid-row:1;gap:9px!important}[data-provider-header-mark]{width:25px!important;height:25px!important}[data-provider-role-badge]{margin-left:4px;font-size:9px!important}[data-provider-role-badge] svg{width:11px!important;height:11px!important}[data-provider-header-side]{grid-column:2;grid-row:1;justify-self:end}[data-provider-header-side] [data-provider-header-chevron]{width:18px}[data-provider-quota-mini]{grid-column:1;grid-row:2;width:auto!important;max-width:none!important;text-align:left;padding-left:34px!important}[data-provider-header-status]{grid-column:2;grid-row:2;width:auto!important;max-width:100px}[data-provider-model]{min-height:48px}[data-provider-model] input[type=checkbox]{width:17px;height:17px}[data-providers-section] button,[data-provider-card] button{min-height:44px}}",
			"@media (pointer:coarse){[data-sortable-handle],[data-sortable-move]{min-width:44px;min-height:44px}}"
		].join("\n");
		function Svg(props) {
			return (0, react_jsx_runtime.jsxs)("svg", {
				className: "pu-logo",
				viewBox: props.viewBox,
				preserveAspectRatio: "xMidYMid meet",
				"aria-hidden": true,
				children: [
					" ",
					props.children,
					" "
				]
			});
		}
		const DEEPSEEK_FISH_PATH = "M22.9168 1.43018C22.6713 1.31018 22.5658 1.53918 22.4223 1.65519C22.3733 1.69269 22.3318 1.74169 22.2903 1.78669C21.9317 2.1697 21.5127 2.42121 20.9657 2.39121C20.1657 2.34621 19.4827 2.59771 18.8787 3.20973C18.7502 2.45521 18.3236 2.0047 17.6746 1.71569C17.3351 1.56568 16.9916 1.41518 16.7536 1.08867C16.5876 0.856163 16.5421 0.597155 16.4591 0.341647C16.4061 0.187643 16.3536 0.0301382 16.1761 0.00363739C15.9836 -0.0263635 15.9081 0.135141 15.8326 0.270145C15.5306 0.822162 15.4136 1.43018 15.4251 2.0462C15.4516 3.43174 16.0366 4.53527 17.1991 5.3203C17.3311 5.4103 17.3651 5.5003 17.3236 5.63181C17.2441 5.90231 17.1501 6.16482 17.0671 6.43533C17.0141 6.60784 16.9351 6.64584 16.7501 6.57033C16.1121 6.30383 15.5611 5.90931 15.074 5.4328C14.2475 4.63328 13.5 3.75075 12.568 3.05973C12.349 2.89822 12.13 2.74822 11.9034 2.60522C10.9524 1.68169 12.028 0.923165 12.277 0.833162C12.5375 0.739159 12.3675 0.41615 11.5259 0.42015C10.6844 0.42365 9.91439 0.705658 8.93286 1.08117C8.78935 1.13767 8.63835 1.17867 8.48384 1.21267C7.59332 1.04367 6.66829 1.00617 5.70226 1.11517C3.88321 1.31768 2.43016 2.1777 1.36213 3.64575C0.0790928 5.4103 -0.222916 7.41536 0.146595 9.50642C0.535106 11.7105 1.66014 13.535 3.38869 14.9616C5.18125 16.4406 7.24581 17.1657 9.60138 17.0266C11.0319 16.9441 12.6245 16.7526 14.421 15.2321C14.874 15.4576 15.3496 15.5476 16.1381 15.6151C16.7456 15.6716 17.3306 15.5851 17.7836 15.4911C18.4931 15.3411 18.4441 14.6841 18.1876 14.5636C16.1081 13.595 16.5646 13.9891 16.1496 13.67C17.2061 12.42 18.8202 10.1979 19.3182 7.17235C19.3672 6.83834 19.4297 6.36783 19.4222 6.09732C19.4182 5.93231 19.4562 5.86831 19.6447 5.84931C20.1657 5.78931 20.6712 5.64681 21.1357 5.3913C22.4833 4.65528 23.0268 3.44624 23.1548 1.9972C23.1738 1.77569 23.1508 1.54668 22.9168 1.43018ZM11.1749 14.4736C9.15936 12.889 8.18184 12.3675 7.77832 12.39C7.40081 12.4125 7.46881 12.8445 7.55182 13.126C7.63882 13.404 7.75182 13.5955 7.91033 13.8396C8.01983 14.0011 8.09533 14.2411 7.80083 14.4216C7.15181 14.8231 6.02327 14.2866 5.97027 14.2601C4.65673 13.4865 3.5587 12.4655 2.78467 11.069C2.03715 9.72493 1.60314 8.28289 1.53164 6.74384C1.51264 6.37233 1.62214 6.24082 1.99215 6.17332C2.47916 6.08332 2.98118 6.06432 3.46769 6.13582C5.52476 6.43633 7.27581 7.35586 8.74385 8.8129C9.58188 9.64243 10.2159 10.634 10.8689 11.6025C11.5634 12.631 12.3105 13.611 13.262 14.4146C13.598 14.6961 13.866 14.9101 14.1225 15.0681C13.349 15.1546 12.058 15.1731 11.1749 14.4746L11.1749 14.4736ZM12.141 8.25988C12.141 8.09488 12.273 7.96338 12.439 7.96338C12.4765 7.96338 12.5105 7.97088 12.541 7.98188C12.5825 7.99688 12.6205 8.01938 12.6505 8.05338C12.7035 8.10588 12.7335 8.18088 12.7335 8.25988C12.7335 8.42489 12.6015 8.55639 12.4355 8.55639C12.2695 8.55639 12.141 8.42489 12.141 8.25988ZM15.1415 9.79893C14.949 9.87793 14.7565 9.94544 14.5715 9.95294C14.2845 9.96794 13.9715 9.85143 13.8015 9.70893C13.5375 9.48742 13.3485 9.36342 13.2695 8.97691C13.2355 8.8119 13.2545 8.55639 13.2845 8.40989C13.3525 8.09438 13.277 7.89187 13.0545 7.70787C12.8735 7.55786 12.643 7.51636 12.39 7.51636C12.2955 7.51636 12.209 7.47486 12.1445 7.44136C12.039 7.38886 11.9519 7.25735 12.035 7.09585C12.0615 7.04335 12.19 6.91584 12.22 6.89334C12.5635 6.69784 12.9595 6.76184 13.326 6.90834C13.6655 7.04735 13.9225 7.30236 14.292 7.66287C14.6695 8.09838 14.7375 8.21838 14.9525 8.54539C15.1225 8.8009 15.277 9.06341 15.3831 9.36392C15.4471 9.55142 15.3641 9.70493 15.1415 9.79893Z";
		const GENERIC_GLOBE_PATH = "M7.00018 0.353516C10.6708 0.353535 13.6468 3.32958 13.6469 7.00018C13.6468 10.6708 10.6708 13.6468 7.00018 13.6469C3.32957 13.6468 0.353535 10.6708 0.353516 7.00018C0.353535 3.32957 3.32957 0.353531 7.00018 0.353516ZM5.44643 7.59661C5.49463 8.97506 5.70762 10.191 6.02136 11.0793C6.20141 11.5891 6.40328 11.9585 6.59898 12.1889C6.79501 12.4196 6.93213 12.454 7.00018 12.454C7.06822 12.454 7.20533 12.4197 7.40138 12.1889C7.59708 11.9585 7.79895 11.589 7.979 11.0793C8.29274 10.191 8.50574 8.97506 8.55394 7.59661H5.44643ZM1.57861 7.59661C1.80785 9.70467 3.2386 11.4509 5.1715 12.1388C5.07135 11.9317 4.97972 11.7098 4.89746 11.477C4.53084 10.4391 4.30224 9.0828 4.25357 7.59661H1.57861ZM9.74679 7.59661C9.69813 9.0828 9.46952 10.4391 9.1029 11.477C9.0206 11.7099 8.92818 11.9316 8.82797 12.1388C10.7613 11.4511 12.1925 9.70496 12.4218 7.59661H9.74679ZM5.1706 1.8616C3.23814 2.54963 1.80876 4.29604 1.5795 6.40376H4.25357C4.30224 4.91756 4.53083 3.56129 4.89746 2.5234C4.97968 2.29066 5.07051 2.0686 5.1706 1.8616ZM7.00018 1.54637C6.93213 1.54638 6.79503 1.5807 6.59898 1.81145C6.40332 2.04177 6.20139 2.41058 6.02136 2.92012C5.70754 3.80851 5.49461 5.02499 5.44643 6.40376H8.55394C8.50575 5.025 8.29282 3.80851 7.979 2.92012C7.79898 2.41059 7.59705 2.04177 7.40138 1.81145C7.20531 1.58067 7.06823 1.54637 7.00018 1.54637ZM8.82887 1.8616C8.92902 2.0687 9.02064 2.29053 9.1029 2.5234C9.46953 3.56129 9.69812 4.91756 9.74679 6.40376H12.4209C12.1916 4.29575 10.7618 2.54943 8.82887 1.8616Z";
		function ProviderMark(props) {
			const raw = props.providerKey;
			switch (raw === "cursor-agent" || raw === "cursor" || raw === "acp-cursor" ? "llm-cursor" : raw === "claude-agent" || raw === "claude" || raw === "claude-code" || raw === "acp-claude" ? "llm-claude" : raw.startsWith("llm-") ? raw : raw === "opencode" ? "llm-opencode-go" : "llm-" + raw) {
				case "llm-claude": return (0, react_jsx_runtime.jsx)(Svg, {
					viewBox: "0 0 24 24",
					children: (0, react_jsx_runtime.jsx)("path", {
						fill: "currentColor",
						d: "m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"
					})
				});
				case "llm-cursor": return (0, react_jsx_runtime.jsx)(Svg, {
					viewBox: "0.24 -1.44 23.6 26.88",
					children: (0, react_jsx_runtime.jsx)("path", {
						fill: "currentColor",
						d: "M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23"
					})
				});
				case "llm-antigravity": return (0, react_jsx_runtime.jsx)(Svg, {
					viewBox: "13.4 8.4 142.1 129.9",
					children: (0, react_jsx_runtime.jsx)("path", {
						fill: "currentColor",
						d: "M84.5 16C64 16 57 39 49 67C42 93 36 111 24 122C18 128 22 132 28 132C42 132 50 116 59 99C66 85 72 78 84.5 78C97 78 103 85 110 99C119 116 127 132 141 132C147 132 151 128 145 122C133 111 127 93 120 67C112 39 105 16 84.5 16Z"
					})
				});
				case "llm-codex": return (0, react_jsx_runtime.jsx)(Svg, {
					viewBox: "-1.2 -1.44 26.6 26.88",
					children: (0, react_jsx_runtime.jsx)("path", {
						fill: "currentColor",
						d: "M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"
					})
				});
				case "llm-ollama": return (0, react_jsx_runtime.jsx)(Svg, {
					viewBox: "1.8 -1.44 20.4 26.88",
					children: (0, react_jsx_runtime.jsx)("path", {
						fill: "currentColor",
						d: "M16.361 10.26a.894.894 0 0 0-.558.47l-.072.148.001.207c0 .193.004.217.059.353.076.193.152.312.291.448.24.238.51.3.872.205a.86.86 0 0 0 .517-.436.752.752 0 0 0 .08-.498c-.064-.453-.33-.782-.724-.897a1.06 1.06 0 0 0-.466 0zm-9.203.005c-.305.096-.533.32-.65.639a1.187 1.187 0 0 0-.06.52c.057.309.31.59.598.667.362.095.632.033.872-.205.14-.136.215-.255.291-.448.055-.136.059-.16.059-.353l.001-.207-.072-.148a.894.894 0 0 0-.565-.472 1.02 1.02 0 0 0-.474.007Zm4.184 2c-.131.071-.223.25-.195.383.031.143.157.288.353.407.105.063.112.072.117.136.004.038-.01.146-.029.243-.02.094-.036.194-.036.222.002.074.07.195.143.253.064.052.076.054.255.059.164.005.198.001.264-.03.169-.082.212-.234.15-.525-.052-.243-.042-.28.087-.355.137-.08.281-.219.324-.314a.365.365 0 0 0-.175-.48.394.394 0 0 0-.181-.033c-.126 0-.207.03-.355.124l-.085.053-.053-.032c-.219-.13-.259-.145-.391-.143a.396.396 0 0 0-.193.032zm.39-2.195c-.373.036-.475.05-.654.086-.291.06-.68.195-.951.328-.94.46-1.589 1.226-1.787 2.114-.04.176-.045.234-.045.53 0 .294.005.357.043.524.264 1.16 1.332 2.017 2.714 2.173.3.033 1.596.033 1.896 0 1.11-.125 2.064-.727 2.493-1.571.114-.226.169-.372.22-.602.039-.167.044-.23.044-.523 0-.297-.005-.355-.045-.531-.288-1.29-1.539-2.304-3.072-2.497a6.873 6.873 0 0 0-.855-.031zm.645.937a3.283 3.283 0 0 1 1.44.514c.223.148.537.458.671.662.166.251.26.508.303.82.02.143.01.251-.043.482-.08.345-.332.705-.672.957a3.115 3.115 0 0 1-.689.348c-.382.122-.632.144-1.525.138-.582-.006-.686-.01-.853-.042-.57-.107-1.022-.334-1.35-.68-.264-.28-.385-.535-.45-.946-.03-.192.025-.509.137-.776.136-.326.488-.73.836-.963.403-.269.934-.46 1.422-.512.187-.02.586-.02.773-.002zm-5.503-11a1.653 1.653 0 0 0-.683.298C5.617.74 5.173 1.666 4.985 2.819c-.07.436-.119 1.04-.119 1.503 0 .544.064 1.24.155 1.721.02.107.031.202.023.208a8.12 8.12 0 0 1-.187.152 5.324 5.324 0 0 0-.949 1.02 5.49 5.49 0 0 0-.94 2.339 6.625 6.625 0 0 0-.023 1.357c.091.78.325 1.438.727 2.04l.13.195-.037.064c-.269.452-.498 1.105-.605 1.732-.084.496-.095.629-.095 1.294 0 .67.009.803.088 1.266.095.555.288 1.143.503 1.534.071.128.243.393.264.407.007.003-.014.067-.046.141a7.405 7.405 0 0 0-.548 1.873c-.062.417-.071.552-.071.991 0 .56.031.832.148 1.279L3.42 24h1.478l-.05-.091c-.297-.552-.325-1.575-.068-2.597.117-.472.25-.819.498-1.296l.148-.29v-.177c0-.165-.003-.184-.057-.293a.915.915 0 0 0-.194-.25 1.74 1.74 0 0 1-.385-.543c-.424-.92-.506-2.286-.208-3.451.124-.486.329-.918.544-1.154a.787.787 0 0 0 .223-.531c0-.195-.07-.355-.224-.522a3.136 3.136 0 0 1-.817-1.729c-.14-.96.114-2.005.69-2.834.563-.814 1.353-1.336 2.237-1.475.199-.033.57-.028.776.01.226.04.367.028.512-.041.179-.085.268-.19.374-.431.093-.215.165-.333.36-.576.234-.29.46-.489.822-.729.413-.27.884-.467 1.352-.561.17-.035.25-.04.569-.04.319 0 .398.005.569.04a4.07 4.07 0 0 1 1.914.997c.117.109.398.457.488.602.034.057.095.177.132.267.105.241.195.346.374.43.14.068.286.082.503.045.343-.058.607-.053.943.016 1.144.23 2.14 1.173 2.581 2.437.385 1.108.276 2.267-.296 3.153-.097.15-.193.27-.333.419-.301.322-.301.722-.001 1.053.493.539.801 1.866.708 3.036-.062.772-.26 1.463-.533 1.854a2.096 2.096 0 0 1-.224.258.916.916 0 0 0-.194.25c-.054.109-.057.128-.057.293v.178l.148.29c.248.476.38.823.498 1.295.253 1.008.231 2.01-.059 2.581a.845.845 0 0 0-.044.098c0 .006.329.009.732.009h.73l.02-.074.036-.134c.019-.076.057-.3.088-.516.029-.217.029-1.016 0-1.258-.11-.875-.295-1.57-.597-2.226-.032-.074-.053-.138-.046-.141.008-.005.057-.074.108-.152.376-.569.607-1.284.724-2.228.031-.26.031-1.378 0-1.628-.083-.645-.182-1.082-.348-1.525a6.083 6.083 0 0 0-.329-.7l-.038-.064.131-.194c.402-.604.636-1.262.727-2.04a6.625 6.625 0 0 0-.024-1.358 5.512 5.512 0 0 0-.939-2.339 5.325 5.325 0 0 0-.95-1.02 8.097 8.097 0 0 1-.186-.152.692.692 0 0 1 .023-.208c.208-1.087.201-2.443-.017-3.503-.19-.924-.535-1.658-.98-2.082-.354-.338-.716-.482-1.15-.455-.996.059-1.8 1.205-2.116 3.01a6.805 6.805 0 0 0-.097.726c0 .036-.007.066-.015.066a.96.96 0 0 1-.149-.078A4.857 4.857 0 0 0 12 3.03c-.832 0-1.687.243-2.456.698a.958.958 0 0 1-.148.078c-.008 0-.015-.03-.015-.066a6.71 6.71 0 0 0-.097-.725C8.997 1.392 8.337.319 7.46.048a2.096 2.096 0 0 0-.585-.041Zm.293 1.402c.248.197.523.759.682 1.388.03.113.06.244.069.292.007.047.026.152.041.233.067.365.098.76.102 1.24l.002.475-.12.175-.118.178h-.278c-.324 0-.646.041-.954.124l-.238.06c-.033.007-.038-.003-.057-.144a8.438 8.438 0 0 1 .016-2.323c.124-.788.413-1.501.696-1.711.067-.05.079-.049.157.013zm9.825-.012c.17.126.358.46.498.888.28.854.36 2.028.212 3.145-.019.14-.024.151-.057.144l-.238-.06a3.693 3.693 0 0 0-.954-.124h-.278l-.119-.178-.119-.175.002-.474c.004-.669.066-1.19.214-1.772.157-.623.434-1.185.68-1.382.078-.062.09-.063.159-.012z"
					})
				});
				case "llm-grok": return (0, react_jsx_runtime.jsxs)(Svg, {
					viewBox: "-33.7 -30.4 629.4 604.9",
					children: [(0, react_jsx_runtime.jsx)("path", {
						fill: "currentColor",
						d: "M411 105C376 80 334 66 289 66C173 66 79 160 79 276C79 306 85 329 95 353C117 407 87 451 0 542L178 383C150 355 134 318 134 277C134 192 203 123 289 123C310 123 330 127 348 134Z"
					}), (0, react_jsx_runtime.jsx)("path", {
						fill: "currentColor",
						d: "M167 448L230 418C248 426 268 430 289 430C374 430 443 361 443 277C443 256 439 234 431 214C427 206 416 204 407 210L217 349L562 2C480 103 475 144 494 229C518 333 468 422 391 459C319 494 235 498 167 448Z"
					})]
				});
				case "llm-commandcode": return (0, react_jsx_runtime.jsxs)(Svg, {
					viewBox: "-8.2 -8.2 152.5 152.5",
					children: [
						(0, react_jsx_runtime.jsx)("path", {
							fill: "currentColor",
							d: "m0 66.7959c0-31.4879 0-47.2318 9.78204-57.01386 9.78206-9.78204 25.52596-9.78204 57.01396-9.78204h2.5357c31.4883 0 47.2323 0 57.0143 9.78204 9.782 9.78206 9.782 25.52596 9.782 57.01396v2.5357c0 31.4883 0 47.2323-9.782 57.0143s-25.526 9.782-57.0144 9.782h-2.5357c-31.4879 0-47.2318 0-57.01386-9.782-9.78204-9.782-9.78204-25.526-9.78204-57.0144z"
						}),
						(0, react_jsx_runtime.jsx)("path", {
							clipRule: "evenodd",
							fill: "currentColor",
							fillRule: "evenodd",
							d: "m69.3317 5.56633h-2.5357c-15.9014 0-27.2674.01182-35.905 1.17312-8.4775 1.13977-13.4886 3.29415-17.173 6.97855s-5.83878 8.6955-6.97855 17.173c-1.1613 8.6376-1.17312 20.0036-1.17312 35.9049v2.5357c0 15.9014.01182 27.2674 1.17312 35.9054 1.13977 8.477 3.29415 13.488 6.97855 17.173 3.6844 3.684 8.6955 5.838 17.173 6.978 8.6376 1.161 20.0036 1.173 35.9049 1.173h2.5357c15.9014 0 27.2674-.012 35.9054-1.173 8.477-1.14 13.488-3.294 17.173-6.978 3.684-3.685 5.838-8.696 6.978-17.173 1.161-8.638 1.173-20.004 1.173-35.9053v-2.5357c0-15.9014-.012-27.2674-1.173-35.905-1.14-8.4775-3.294-13.4886-6.978-17.173-3.685-3.6844-8.696-5.83878-17.173-6.97855-8.638-1.1613-20.004-1.17312-35.9053-1.17312zm-59.54966 4.21571c-9.78204 9.78206-9.78204 25.52596-9.78204 57.01386v2.5357c0 31.4884 0 47.2324 9.78204 57.0144 9.78206 9.782 25.52596 9.782 57.01386 9.782h2.5357c31.4884 0 47.2324 0 57.0144-9.782s9.782-25.526 9.782-57.0143v-2.5357c0-31.488 0-47.2319-9.782-57.01396-9.782-9.78204-25.526-9.78204-57.0143-9.78204h-2.5357c-31.488 0-47.2319 0-57.01396 9.78204z"
						}),
						(0, react_jsx_runtime.jsx)("path", {
							fill: "var(--dsw-alias-bg-layer-1)",
							d: "m93.6604 26.1784c-8.982 0-16.2887 7.3067-16.2887 16.2888v6.9809h-18.6158v-6.9809c0-8.9821-7.3067-16.2888-16.2887-16.2888-8.9821 0-16.2888 7.3067-16.2888 16.2888s7.3067 16.2887 16.2888 16.2887h6.9809v18.6158h-6.9809c-8.9821 0-16.2888 7.3067-16.2888 16.2888 0 8.9825 7.3067 16.2885 16.2888 16.2885 8.982 0 16.2887-7.306 16.2887-16.2885v-6.981h18.6158v6.981c0 8.9825 7.3067 16.2885 16.2887 16.2885 8.9826 0 16.2886-7.306 16.2886-16.2885 0-8.9821-7.306-16.2888-16.2886-16.2888h-6.9809v-18.6158h6.9809c8.9826 0 16.2886-7.3066 16.2886-16.2887s-7.306-16.2888-16.2886-16.2888zm-6.9809 23.2697v-6.9809c0-3.8628 3.1182-6.9809 6.9809-6.9809 3.8628 0 6.9806 3.1181 6.9806 6.9809 0 3.8627-3.1178 6.9809-6.9806 6.9809zm-44.2123 0c-3.8628 0-6.9809-3.1182-6.9809-6.9809 0-3.8628 3.1181-6.9809 6.9809-6.9809 3.8627 0 6.9809 3.1181 6.9809 6.9809v6.9809zm16.2887 27.9236v-18.6158h18.6158v18.6158zm34.9045 23.2693c-3.8627 0-6.9809-3.1178-6.9809-6.9805v-6.981h6.9809c3.8628 0 6.9806 3.1182 6.9806 6.981 0 3.8627-3.1178 6.9805-6.9806 6.9805zm-51.1932 0c-3.8628 0-6.9809-3.1178-6.9809-6.9805 0-3.8628 3.1181-6.981 6.9809-6.981h6.9809v6.981c0 3.8627-3.1182 6.9805-6.9809 6.9805z"
						})
					]
				});
				case "llm-deepseek":
				case "llm-deepseek-official": return (0, react_jsx_runtime.jsx)(Svg, {
					viewBox: "0 0 23.16 17.04",
					children: (0, react_jsx_runtime.jsx)("path", {
						fill: "currentColor",
						d: DEEPSEEK_FISH_PATH
					})
				});
				case "llm-opencode-go": return (0, react_jsx_runtime.jsxs)(Svg, {
					viewBox: "120.6 86.4 286.1 359.4",
					children: [(0, react_jsx_runtime.jsx)("path", {
						fill: "currentColor",
						opacity: ".35",
						d: "M320 224V352H192V224H320Z"
					}), (0, react_jsx_runtime.jsx)("path", {
						fill: "currentColor",
						fillRule: "evenodd",
						d: "M384 416H128V96H384V416ZM320 160H192V352H320V160Z"
					})]
				});
				default: return (0, react_jsx_runtime.jsx)(Svg, {
					viewBox: "0 0 14 14",
					children: (0, react_jsx_runtime.jsx)("path", {
						fill: "currentColor",
						fillRule: "evenodd",
						clipRule: "evenodd",
						d: GENERIC_GLOBE_PATH
					})
				});
			}
		}
		//#endregion
		//#region src/client/runtime-lock.ts
		/** Decode a wire reply only for the provider that owns the query. */
		function decodeBindingProvider(value, provider) {
			if (value === null || typeof value !== "object" || Array.isArray(value)) return void 0;
			const reply = value;
			return reply.provider === null || reply.provider === provider ? reply.provider : void 0;
		}
		/** Query installed declarations; one failed query must never become a successful unbound read. */
		async function fetchSessionBinding(rpc, sessionId, sources) {
			if (sources.length === 0) return {
				provider: null,
				failed: false
			};
			if (rpc === void 0) return {
				provider: null,
				failed: true
			};
			const replies = await Promise.all(sources.map(async (source) => {
				try {
					const result = await callPluginRpc(rpc, source.channel, source.endpoint, { sessionId });
					return result.ok ? decodeBindingProvider(result.value, source.provider) : void 0;
				} catch {
					return;
				}
			}));
			const bindings = new Set(replies.filter((value) => typeof value === "string"));
			return {
				provider: bindings.size === 1 ? [...bindings][0] : null,
				failed: replies.includes(void 0) || bindings.size > 1
			};
		}
		/** Whether one provider remains selectable under a known lock read. */
		function providerSelectable(lock, provider) {
			return lock === null || provider === lock;
		}
		/**
		* Existing DSH history cannot convert to an External Agent. Blank sessions
		* and already-bound native sessions keep their current Agent choice.
		*/
		function agentProviderLocked(blank, bound, active = false) {
			return (blank === false || active) && bound === null;
		}
		/** Picker allow-check over the already-effective lock and the agentLocked bit. */
		function runtimeChoiceAllowed(lock, agentLocked, provider, currentProvider, agent) {
			if (!providerSelectable(lock, provider)) return false;
			if (agentLocked && agent) return provider === currentProvider;
			return true;
		}
		/**
		* Whether one provider remains selectable under a lock read that may have failed.
		* Failed reads keep only the known binding or current selection selectable;
		* active Agent selections reserve their runtime before the first binding arrives.
		* Unbound sessions with DSH history cannot select a new Agent provider.
		* Log reading is never gated by this.
		* @param state - Latest lock read for the session.
		* @param provider - Candidate provider for the pending selection.
		* @param currentProvider - Session current provider, if any.
		* @param context - Session history, request activity, and candidate Agent role.
		*/
		function isProviderAllowed(state, provider, currentProvider, context = {}) {
			if (state.failed && provider !== (state.provider ?? currentProvider)) return false;
			const lock = effectiveProviderLock(state, currentProvider, context.active, context.currentAgent);
			if (!providerSelectable(lock, provider)) return false;
			if (context.agent === true && (context.blank === false || context.active === true) && lock === null) return provider === currentProvider;
			return true;
		}
		/**
		* Effective single-provider lock for pickers that only understand
		* RuntimeProviderLock. Errors fail closed exactly as isProviderAllowed does.
		*/
		function effectiveProviderLock(state, currentProvider, active = false, currentAgent = false) {
			if (state.provider !== null) return state.provider;
			if (state.failed || active && currentAgent) return currentProvider ?? null;
			return null;
		}
		/**
		* Create one session lock store over an injecting query.
		* The query sees the previous snapshot for sticky failure mapping and never
		* throws (failures resolve to failed reads); refresh never rejects.
		*/
		function createProviderLockStore(query) {
			let current = {
				provider: null,
				failed: false
			};
			const listeners = /* @__PURE__ */ new Set();
			let generation = 0;
			const emit = () => {
				for (const listener of [...listeners]) listener();
			};
			return {
				subscribe: (listener) => {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				getSnapshot: () => current,
				refresh: async () => {
					const seen = ++generation;
					const previous = current;
					let next;
					try {
						next = await query(previous);
					} catch {
						next = {
							provider: previous.provider,
							failed: true
						};
					}
					if (seen !== generation) return current;
					if (next.provider !== current.provider || next.failed !== current.failed) {
						current = next;
						emit();
					}
					return current;
				}
			};
		}
		//#endregion
		//#region \0dsh-css:src/client/picker/ComposerPicker.module.css.mjs
		const css$1 = ".GdQohq_root{min-width:0;position:relative}.GdQohq_trigger{width:fit-content;min-width:0;max-width:256px;min-height:28px;color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xs-strong-13);cursor:pointer;background:0 0;border:none;border-radius:24px;outline:none;align-items:center;gap:4px;padding:4px 4px 4px 8px;display:flex}.GdQohq_trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.GdQohq_trigger:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}.GdQohq_trigger:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}.GdQohq_triggerLabel{overflow-wrap:normal;text-overflow:ellipsis;white-space:nowrap;align-items:center;gap:4px;min-width:0;display:inline-flex;overflow:hidden}.GdQohq_triggerEffort{color:var(--dsw-alias-label-caption);flex:none}.GdQohq_chevron{color:var(--dsw-alias-label-caption);transition:transform .12s var(--ds-ease-in-out);flex:none}.GdQohq_chevronOpen{transform:rotate(180deg)}.GdQohq_embedded{width:100%}.GdQohq_embedded .GdQohq_trigger{background:var(--dsw-alias-interactive-bg-hover);width:100%;max-width:none;min-height:36px;color:var(--dsw-alias-label-primary);border-radius:10px;justify-content:space-between;padding:4px 10px}.GdQohq_embedded .GdQohq_trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.GdQohq_capsule{width:100%}.GdQohq_capsule .GdQohq_trigger{border:1px solid var(--dsw-alias-border-inverted);background:var(--dsw-specific-input-major);width:100%;max-width:none;min-height:32px;color:var(--dsw-alias-label-primary);border-radius:24px;justify-content:space-between;padding:4px 8px 4px 10px}.GdQohq_capsule .GdQohq_trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.GdQohq_menu{box-sizing:border-box;width:min(280px, max(0px, calc(100vw - 32px - env(safe-area-inset-left) - env(safe-area-inset-right))));max-height:min(360px, calc(56dvh - env(safe-area-inset-bottom)));border:1px solid var(--dsw-alias-border-inverted);background:var(--dsw-specific-menu);box-shadow:var(--dsw-shadow-lv3);color:var(--dsw-alias-label-primary);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border-radius:12px;flex-direction:column;padding:4px;display:flex;overflow:hidden}.GdQohq_paneHeader{flex:none;grid-template-columns:32px minmax(0,1fr) 32px;align-items:center;gap:8px;min-height:40px;padding:2px 4px;display:grid}.GdQohq_paneHeader .GdQohq_headerButton{width:32px;min-width:32px;height:32px;color:var(--dsw-alias-label-secondary);padding:0}.GdQohq_paneHeader .GdQohq_headerButton:last-child{justify-self:end}.GdQohq_paneTitle{min-width:0;color:var(--dsw-alias-label-primary);font:var(--dsw-font-s-strong-14);overflow-wrap:anywhere;text-align:center;padding:4px 8px}.GdQohq_searchSlot{min-width:0;overflow:hidden}.GdQohq_headerSearch{box-sizing:border-box;width:100%;min-width:0;max-width:100%;display:flex}.GdQohq_headerSearch input::-webkit-search-cancel-button{display:none}.GdQohq_list{min-height:0;overflow:hidden auto}.GdQohq_status,.GdQohq_empty{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xs-13);overflow-wrap:anywhere;padding:10px}.GdQohq_error,.GdQohq_warning{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);font:var(--dsw-font-xxs-12);overflow-wrap:anywhere;border-radius:8px;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px;padding:7px 8px;display:flex}.GdQohq_warning{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-state-warn-label)}.GdQohq_retry{color:inherit;font:var(--dsw-font-xxs-strong-12);cursor:pointer;background:0 0;border:none;flex:none;padding:0}.GdQohq_groups{min-height:0}.GdQohq_group+.GdQohq_group{margin-top:4px}.GdQohq_groupTitle{z-index:1;background:var(--dsw-specific-menu);color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxs-strong-12);overflow-wrap:anywhere;align-items:center;gap:6px;padding:5px 8px 3px;display:flex;position:sticky;top:0}.GdQohq_runtimeMark{min-width:14px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-strong-12);justify-content:center;align-items:center;display:inline-flex}.GdQohq_runtimeMark svg{width:14px;height:14px;display:block}.GdQohq_option{box-sizing:border-box;width:auto;min-width:100%;min-height:38px;color:inherit;text-align:left;cursor:pointer;background:0 0;border:none;border-radius:10px;outline:none;align-items:center;gap:8px;padding:6px 8px;display:flex}.GdQohq_option:hover:not(:disabled),.GdQohq_option:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}.GdQohq_selected{background:0 0}.GdQohq_option:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}.GdQohq_optionCopy{flex-direction:column;flex:1;min-width:0;display:flex}.GdQohq_modelName{color:inherit;font:var(--dsw-font-s-strong-14);overflow-wrap:anywhere}.GdQohq_description{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxs-12);overflow-wrap:anywhere}.GdQohq_check{color:var(--dsw-alias-label-primary);flex:0 0 18px;place-items:center;display:grid}.GdQohq_cell{box-sizing:border-box;width:auto;min-width:100%;height:40px;min-height:40px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-s-14);cursor:pointer;text-align:left;background:0 0;border:none;border-radius:10px;align-items:center;gap:8px;padding:0 10px;display:flex}.GdQohq_cell:hover{background:var(--dsw-alias-interactive-bg-hover)}.GdQohq_cellLabel{white-space:nowrap;flex:none}.GdQohq_cellValue{min-width:0;color:var(--dsw-alias-label-tertiary);text-align:right;text-overflow:ellipsis;white-space:nowrap;flex:auto;overflow:hidden}.GdQohq_cellChevron{color:var(--dsw-alias-label-tertiary);flex:none}";
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
						icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronLeftOutlineRegular, { size: 14 }),
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
						icon: searching ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutlineRegular, { size: 16 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutlineRegular, { size: 16 }),
						"aria-label": searching ? closeSearchLabel : searchLabel,
						onClick: searching ? onCloseSearch : onStartSearch
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { "aria-hidden": true })
				]
			});
		}
		function RuntimeIcon({ provider, roleOf }) {
			const mark = isAgentRole(roleOf?.(provider)) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderMark, { providerKey: provider }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderMark, { providerKey: "deepseek-official" });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: ComposerPicker_module_css_default.runtimeMark,
				children: mark
			});
		}
		function ComposerPicker({ locked, providerLock = null, agentLocked = false, available, directory, t, draft, onDraftChange, embedded, tone, resolveInteractionOperations, roleOf }) {
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
			const choiceAllowed = (provider) => runtimeChoiceAllowed(providerLock, agentLocked, provider, currentSelection?.provider, isAgentRole(roleOf?.(provider)));
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
				if (lockedRef.current || !choiceAllowed(next.provider)) return;
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
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {
										size: 14,
										className: ComposerPicker_module_css_default.cellChevron
									})
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
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {
										size: 14,
										className: ComposerPicker_module_css_default.cellChevron
									})
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
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {
										size: 14,
										className: ComposerPicker_module_css_default.cellChevron
									})
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
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {
										size: 14,
										className: ComposerPicker_module_css_default.cellChevron
									})
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
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {
										size: 14,
										className: ComposerPicker_module_css_default.cellChevron
									})
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
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RuntimeIcon, {
												provider: section.provider,
												...roleOf === void 0 ? {} : { roleOf }
											}), section.providerName]
										}), section.families.map((item) => {
											const selected = currentSelection?.provider === item.provider && item.members.some((entry) => entry.model.id === currentSelection.model);
											const representative = member !== void 0 && family?.provider === item.provider && family.base === item.base ? member : item.members.find((entry) => !entry.fast && entry.contextTier === null) ?? item.members[0];
											return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
												type: "button",
												role: "menuitemradio",
												"aria-checked": selected,
												className: classNames(ComposerPicker_module_css_default.option, selected && ComposerPicker_module_css_default.selected),
												disabled: locked || busy || !choiceAllowed(item.provider),
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
													children: selected ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutlineRegular, { size: 16 }) : null
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
							disabled: locked || busy || family !== void 0 && !choiceAllowed(family.provider),
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
								children: effectiveEffort === level.id ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutlineRegular, { size: 16 }) : null
							})]
						}, level.id))),
						pane === "context" && family !== void 0 && member !== void 0 && contextTiers(family).map((row) => {
							const next = pickVariant(family, member, { contextTier: row.tier });
							const selected = member.contextTier === row.tier;
							const honored = next.contextTier === row.tier && next.fast === member.fast && next.thinking === member.thinking;
							const unreachable = !selected && (!honored || next.model.id === member.model.id);
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "menuitemradio",
								"aria-checked": selected,
								className: classNames(ComposerPicker_module_css_default.option, selected && ComposerPicker_module_css_default.selected),
								disabled: locked || busy || !choiceAllowed(family.provider) || unreachable,
								title: unreachable ? t("choice.unavailable") : void 0,
								onClick: () => {
									if (!unreachable) chooseMember(family, next, effectiveEffort);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ComposerPicker_module_css_default.optionCopy,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ComposerPicker_module_css_default.modelName,
										children: contextDisplay(row.label)
									})
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ComposerPicker_module_css_default.check,
									children: selected ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutlineRegular, { size: 16 }) : null
								})]
							}, row.tier ?? "standard");
						}),
						pane === "fast" && family !== void 0 && member !== void 0 && [false, true].map((fast) => {
							const next = pickVariant(family, member, { fast });
							const selected = member.fast === fast;
							const honored = next.fast === fast && next.contextTier === member.contextTier && next.thinking === member.thinking;
							const unreachable = !selected && (!honored || next.model.id === member.model.id);
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "menuitemradio",
								"aria-checked": selected,
								className: classNames(ComposerPicker_module_css_default.option, selected && ComposerPicker_module_css_default.selected),
								disabled: locked || busy || !choiceAllowed(family.provider) || unreachable,
								title: unreachable ? t("choice.unavailable") : void 0,
								onClick: () => {
									if (!unreachable) chooseMember(family, next, effectiveEffort);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ComposerPicker_module_css_default.optionCopy,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ComposerPicker_module_css_default.modelName,
										children: fast ? t("fast.on") : t("fast.off")
									})
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ComposerPicker_module_css_default.check,
									children: selected ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutlineRegular, { size: 16 }) : null
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
								disabled: locked || busy || !choiceAllowed(family.provider),
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
									children: selected ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutlineRegular, { size: 16 }) : null
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
							children: [currentSelection !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RuntimeIcon, {
								provider: currentSelection.provider,
								...roleOf === void 0 ? {} : { roleOf }
							}) : null, triggerLabel]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {
							size: 14,
							className: classNames(ComposerPicker_module_css_default.chevron, open && ComposerPicker_module_css_default.chevronOpen)
						})]
					}),
					menu !== null && (tone === "capsule" ? menu : (0, react_dom.createPortal)(menu, document.body)),
					toast !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
						text: toast.text,
						icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, { size: 16 }),
						anchor: triggerRef.current?.closest("[data-composer-card]") ?? null,
						onDone: () => {
							setToast(null);
						}
					}, toast.seq)
				]
			});
		}
		//#endregion
		//#region node_modules/.pnpm/dsh-llm-providers-ui@https+++github.com+NOirBRight+dsh-llm-providers-ui+releases+downlo_f28016d359656c02bf4c8bae5194f188/node_modules/dsh-llm-providers-ui/lib/order.js
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
		new Map(Object.entries({
			"llm-cursor": "cursor",
			"llm-grok": "grok",
			"llm-codex": "codex",
			"llm-ollama": "ollama-cloud",
			"llm-commandcode": "commandcode",
			"llm-opencode-go": "opencode-go"
		}).map(([key, route]) => [route, key]));
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
		function ownCatalogKey$1(catalogKeys, id) {
			return Object.hasOwn(catalogKeys, id) ? catalogKeys[id] : void 0;
		}
		/**
		* Sort picker/catalog groups from declared directory routes.
		* With a saved card order, mapped providers follow that list; with none, groups keep catalog order.
		* Groups the live map does not know keep catalog order and append after ranked routes.
		* @param catalogKeys - live catalog-group-id → card-key map from ProviderDirectory.catalogRoutes().
		*/
		function sortCatalogGroups(groups, saved = [], catalogKeys = {}) {
			if (saved.length === 0) return [...groups];
			const idByKey = /* @__PURE__ */ new Map();
			for (const [id, key] of Object.entries(catalogKeys)) idByKey.set(key, id);
			const ranked = applySavedOrder(groups.map((group) => ownCatalogKey$1(catalogKeys, group.id)).filter((key) => key !== void 0), saved);
			const rank = new Map(ranked.flatMap((key, index) => {
				const route = idByKey.get(key);
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
		//#region src/client/provider-directory.ts
		/** Optional ProviderDirectory operations consumed by Model Switch. */
		/** Read the optional catalog route map without assuming a particular Providers UI release. */
		function readCatalogRoutes(directory) {
			const catalogRoutes = directory?.catalogRoutes;
			return typeof catalogRoutes === "function" ? catalogRoutes.call(directory) : {};
		}
		/** Read the optional native-binding declarations without assuming a particular Providers UI release. */
		function readNativeBindings(directory) {
			const nativeBindings = directory?.nativeBindings;
			return typeof nativeBindings === "function" ? nativeBindings.call(directory) : [];
		}
		function ownCatalogKey(catalogKeys, id) {
			return Object.hasOwn(catalogKeys, id) ? catalogKeys[id] : void 0;
		}
		/**
		* Rank picker/catalog groups from live ProviderDirectory routes.
		* Published 0.2.8 `sortCatalogGroups` only understands hardcoded LLM routes and
		* ignores a third argument, so Agent catalog ids would keep source order.
		* When the Owner publishes `catalogRoutes`, this ranks those keys locally.
		* With no live map, fall back to the compile-pinned 0.2.8 LLM-only sort.
		*/
		function sortCatalogGroupsWithRoutes(groups, saved = [], catalogKeys = {}) {
			const live = Object.entries(catalogKeys).filter(([id, key]) => Object.hasOwn(catalogKeys, id) && key.length > 0);
			if (live.length === 0) return sortCatalogGroups(groups, saved);
			if (saved.length === 0) return [...groups];
			const idByKey = /* @__PURE__ */ new Map();
			for (const [id, key] of live) idByKey.set(key, id);
			const ranked = applySavedOrder(groups.map((group) => ownCatalogKey(catalogKeys, group.id)).filter((key) => key !== void 0), saved);
			const rank = new Map(ranked.flatMap((key, index) => {
				const route = idByKey.get(key);
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
		function pickerDirectoryViewOrdered(snapshot, operations, order, catalogKeys = {}) {
			return pickerDirectoryView({
				...snapshot,
				groups: sortCatalogGroupsWithRoutes(snapshot.groups, order, catalogKeys)
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
		/** Inline failed lock-read status; history and log reading stay unaffected. */
		function ProviderLockHint(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				role: "alert",
				className: PlanReviewCard_module_css_default.strip,
				"data-provider-lock-failed": true,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: PlanReviewCard_module_css_default.dot }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: PlanReviewCard_module_css_default.stripTitle,
					children: props.t("lock.readFailed")
				})]
			});
		}
		function PlanReviewCard(props) {
			const snapshot = props.useDirectory((value) => value);
			const order = props.useProviderOrder((value) => value);
			const lock = (0, react.useSyncExternalStore)(props.providerLockStore.subscribe, props.providerLockStore.getSnapshot);
			const phase = props.useInput((input) => input.phase);
			const blank = props.useSession((session) => session.blank);
			const active = props.useSession((session) => session.running || session.awaitingFirstTurn) || phase === "submitting";
			(0, react.useEffect)(() => {
				props.refreshProviderLock();
			}, [
				props.refreshProviderLock,
				phase,
				active,
				snapshot,
				order
			]);
			const providerLock = effectiveProviderLock(lock, snapshot.current?.provider, active, isAgentRole(props.roleOf?.(snapshot.current?.provider ?? "")));
			const agentLocked = agentProviderLocked(blank, providerLock, active);
			const review = planReviewOf(props.matched.questions);
			if (review === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: PlanReviewCard_module_css_default.frame,
				"data-plan-review-key": props.matched.key,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: PlanReviewCard_module_css_default.card,
					"aria-label": props.t("plan.header"),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: PlanReviewCard_module_css_default.strip,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: PlanReviewCard_module_css_default.dot }), props.t("plan.header")]
					}), lock.failed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderLockHint, { t: props.t })]
				})
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PlanReviewState, {
				matched: props.matched,
				review,
				available: props.available && (!lock.failed || snapshot.current !== null),
				providerLock,
				agentLocked,
				lockFailed: lock.failed,
				directory: pickerDirectoryViewOrdered(snapshot, props, order, props.catalogRoutes?.() ?? {}),
				t: props.t,
				...props.resolveInteractionOperations === void 0 ? {} : { resolveInteractionOperations: props.resolveInteractionOperations },
				...props.roleOf === void 0 ? {} : { roleOf: props.roleOf }
			}, props.matched.key);
		}
		function PlanReviewState({ matched, review, available, providerLock, agentLocked, lockFailed, directory, t, resolveInteractionOperations, roleOf }) {
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
			const executionAllowed = execution !== void 0 && runtimeChoiceAllowed(providerLock, agentLocked, execution.provider, snapshot.current?.provider, isAgentRole(roleOf?.(execution.provider)));
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
						lockFailed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderLockHint, { t }),
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
											agentLocked,
											...roleOf === void 0 ? {} : { roleOf },
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
											icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutlineRegular, { size: 14 }),
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
			"lock.readFailed": "提供方锁定状态读取失败，模型选项可能不是最新。",
			"choice.unavailable": "目录没有这个组合",
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
			"lock.readFailed": "Provider lock read failed; model choices may be stale.",
			"choice.unavailable": "This combination is not in the catalog",
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
		/**
		* Bind the optional Providers entry order as a React external store.
		* @returns A subscribable order snapshot with an invalidation hook for directory changes.
		*/
		function providerOrderStore(form) {
			const listeners = /* @__PURE__ */ new Set();
			let last = EMPTY_ORDER;
			return {
				subscribe: (listener) => {
					listeners.add(listener);
					const stop = form.subscribe(listener);
					return () => {
						listeners.delete(listener);
						stop();
					};
				},
				getSnapshot: () => {
					const next = form.getSnapshot().value?.order ?? EMPTY_ORDER;
					if (next.length !== last.length || next.some((key, index) => key !== last[index])) last = [...next];
					return last;
				},
				invalidate: () => {
					last = [...last];
					for (const listener of listeners) listener();
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
		async function restoreMainDefault(mainDefaults, before) {
			if (before.status !== "ready" || before.mode !== "host" || !before.writable || before.value === void 0 || before.revision === void 0) return;
			const expectedRevision = before.revision + 1;
			if (!await mainDefaults.mutate(mainDefaultOps(before.value), expectedRevision) && mainDefaults.getSnapshot().revision === expectedRevision) throw new Error("settings-rejected");
		}
		function readSessionState(sessions, sessionId) {
			if (sessions === null || typeof sessions !== "object") return void 0;
			const get = sessions.get;
			if (typeof get !== "function") return void 0;
			try {
				const snapshot = get.call(sessions, sessionId)?.getSnapshot?.();
				if (snapshot === void 0) return void 0;
				return {
					...typeof snapshot.blank === "boolean" ? { blank: snapshot.blank } : {},
					active: snapshot.running === true || snapshot.awaitingFirstTurn === true || (snapshot.pendingSubmissions?.length ?? 0) > 0
				};
			} catch {
				return {
					blank: false,
					active: true
				};
			}
		}
		function ModelSeat(props) {
			const directory = props.useDirectory((snapshot) => snapshot);
			const order = props.useProviderOrder((value) => value);
			const lock = (0, react.useSyncExternalStore)(props.providerLockStore.subscribe, props.providerLockStore.getSnapshot);
			const phase = props.useInput((input) => input.phase);
			const blank = props.useSession((session) => session.blank);
			const active = props.useSession((session) => session.running || session.awaitingFirstTurn) || phase === "submitting";
			(0, react.useEffect)(() => {
				props.refreshProviderLock();
			}, [
				props.refreshProviderLock,
				phase,
				active,
				directory,
				order
			]);
			const providerLock = effectiveProviderLock(lock, directory.current?.provider, active, isAgentRole(props.roleOf?.(directory.current?.provider ?? "")));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [lock.failed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderLockHint, { t: props.t }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ComposerPicker, {
				locked: props.locked || lock.failed && directory.current === null,
				providerLock,
				agentLocked: agentProviderLocked(blank, providerLock, active),
				...props.roleOf === void 0 ? {} : { roleOf: props.roleOf },
				available: props.available,
				directory: pickerDirectoryViewOrdered(directory, props, order, props.catalogRoutes?.() ?? {}),
				t: props.t,
				...props.resolveInteractionOperations === void 0 ? {} : { resolveInteractionOperations: props.resolveInteractionOperations }
			})] });
		}
		function ModelSeatEntry(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PickerSeatBoundary, {
				errorLabel: (message) => props.t("error.picker", { message }),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelSeat, { ...props })
			});
		}
		/** Register composer model picker and Plan Review execution picker. */
		function installComposerPicker(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-model-switch: composer picker dictionaries");
			ctx.inject([
				"slots",
				"modelDirectories",
				"configForms"
			], (scope) => {
				const models = scope.modelDirectories;
				const sessions = scope.sessions;
				const mainDefaults = scope.configForms.get(MAIN_DEFAULT_CONFIG_ID);
				let directoryService;
				const orderStore = providerOrderStore(scope.configForms.get(PROVIDERS_CONFIG_ID));
				scope.inject(["providerDirectory"], (directoryScope) => {
					const directory = directoryScope.get("providerDirectory", false);
					if (directory === void 0 || typeof directory.subscribe !== "function") return;
					directoryService = directory;
					orderStore.invalidate();
					directoryScope.effect(() => directory.subscribe(orderStore.invalidate));
					directoryScope.effect(() => () => {
						if (directoryService === directory) directoryService = void 0;
						orderStore.invalidate();
					});
				});
				const resolveInteractionOperations = () => interactionOperationsFrom(scope);
				const rpcOf = () => {
					return scope.get("connection", false)?.rpc;
				};
				const directoryFace = (sessionId) => {
					const directory = models.directoryFor(sessionId);
					const available = sessions?.subagentAddress?.(sessionId) === void 0;
					const readLock = async (previous) => {
						const result = await fetchSessionBinding(rpcOf(), sessionId, readNativeBindings(directoryService));
						return result.failed ? {
							provider: result.provider ?? previous.provider,
							failed: true
						} : result;
					};
					const roleOf = (key) => readProviderRole(directoryService, key);
					const providerLockStore = createProviderLockStore(readLock);
					return {
						available,
						roleOf,
						catalogRoutes: () => readCatalogRoutes(directoryService),
						providerLockStore,
						refreshProviderLock: () => {
							providerLockStore.refresh();
						},
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
							const state = await providerLockStore.refresh();
							const currentProvider = directory.store.getSnapshot().current?.provider;
							if (!isProviderAllowed(state, selection.provider, currentProvider, {
								...readSessionState(sessions, sessionId),
								agent: isAgentRole(roleOf(selection.provider)),
								currentAgent: currentProvider !== void 0 && isAgentRole(roleOf(currentProvider))
							})) return false;
							const defaultBeforeSwitch = mainDefaults.getSnapshot();
							if (defaultBeforeSwitch.status !== "ready" || defaultBeforeSwitch.mode !== "host" || !defaultBeforeSwitch.writable || defaultBeforeSwitch.value === void 0 || defaultBeforeSwitch.revision === void 0) return false;
							try {
								await directory.select(selection);
								await restoreMainDefault(mainDefaults, defaultBeforeSwitch);
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
			"configForms",
			"remote",
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
			const mainForm = ctx.configForms.get(MAIN_DEFAULT_CONFIG_ID);
			const owned = ctx.configForms.get(MODEL_SWITCH_CONFIG_ID);
			const main = deriveConfigForm(mainForm, (value) => value, {
				provider: "provider",
				model: "model",
				reasoningEffort: "reasoningEffort"
			});
			const subagent = deriveConfigForm(owned, deriveSubagentSettings, SUBAGENT_SETTINGS_FIELDS);
			const search = deriveConfigForm(owned, deriveSearchSettings, SEARCH_SETTINGS_FIELDS);
			const image = deriveConfigForm(owned, deriveImageSettings, IMAGE_SETTINGS_FIELDS);
			const saveMain = async (next, expectedRevision) => {
				if (!await mainForm.mutate([
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
				], expectedRevision)) {
					if (mainForm.getSnapshot().revision !== expectedRevision) throw new MainSettingsConflictError(t("conflict"));
					throw new Error("settings-rejected");
				}
				const revision = mainForm.getSnapshot().revision;
				if (revision === void 0) throw new Error("settings unavailable after save");
				return revision;
			};
			const connectionRpc = (() => {
				try {
					const rpc = ctx.get("connection", false)?.rpc;
					return rpc !== void 0 && typeof rpc.call === "function" ? rpc : void 0;
				} catch {
					return;
				}
			})();
			const orderStore = providerOrderStore(ctx.configForms.get(PROVIDERS_CONFIG_ID));
			let directory;
			ctx.inject(["providerDirectory"], (scope) => {
				const current = scope.get("providerDirectory", false);
				if (current === void 0 || typeof current.subscribe !== "function") return;
				directory = current;
				orderStore.invalidate();
				scope.effect(() => current.subscribe(orderStore.invalidate));
				scope.effect(() => () => {
					if (directory === current) directory = void 0;
					orderStore.invalidate();
				});
			});
			const providerRoleOf = (key) => readProviderRole(directory, key) ?? "llm";
			const subscribeProviderOrder = orderStore.subscribe;
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
						imageSettings: image,
						switchSettings: owned
					},
					capabilities: RUNTIME_CAPABILITIES,
					saveMain,
					setSubagent: (field, value) => value === void 0 ? subagent.unset(field) : subagent.set(field, value),
					setCapability: (route, field, value) => {
						const scope = route === "search" ? search : image;
						return value === void 0 ? scope.unset(field) : scope.set(field, value);
					},
					setCompactOnSwitch: async (value) => {
						if (!await owned.set("compactOnSwitch", value)) throw new Error("settings-rejected");
					},
					providerRoleOf,
					loadCatalog: async () => {
						const response = await remote.session.modelCatalog();
						if (!response.ok || response.value === void 0) throw new Error(t("catalogFailed"));
						const enabled = await fetchAntigravityCatalogGroups(connectionRpc);
						const order = orderStore.getSnapshot();
						return sortCatalogGroupsWithRoutes(withAntigravityCatalog(response.value.groups, enabled), order, readCatalogRoutes(directory));
					},
					...connectionRpc === void 0 ? {} : { loadCapabilities: async (revision, signal) => {
						const rpc = connectionRpc;
						if (rpc === void 0) throw new Error(t("catalogFailed"));
						const response = await callPluginRpc(rpc, "plugin-rpc/model-switch", "capabilities", revision === void 0 ? {} : { revision }, signal);
						if (!response.ok || response.value === void 0) throw new Error(t("catalogFailed"));
						const snapshot = decodeCapabilitiesSnapshot(response.value);
						if (snapshot === void 0) throw new Error(t("catalogFailed"));
						return snapshot;
					} },
					subscribeProviderOrder
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
