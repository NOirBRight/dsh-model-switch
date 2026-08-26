window.__ModuleLoader__.load({
	id: "dsh-model-switch",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client-contract.ts
		const MODEL_SWITCH_SETTINGS_ID = "model-switch";
		const MAIN_SETTINGS_ID = "agent-default-model";
		var MainSettingsConflictError = class extends Error {
			name = "MainSettingsConflictError";
		};
		const SUBAGENT_SETTINGS_FIELDS = Object.freeze({
			mode: "subagentMode",
			provider: "subagentProvider",
			model: "subagentModel"
		});
		const SEARCH_SETTINGS_FIELDS = Object.freeze({
			provider: "searchProvider",
			model: "searchModel"
		});
		const IMAGE_SETTINGS_FIELDS = Object.freeze({
			provider: "imageProvider",
			model: "imageModel"
		});
		function record(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
		}
		function optionalString(value) {
			return typeof value === "string" ? value : void 0;
		}
		function decodeMainSettings(value) {
			const item = record(value);
			if (item === void 0 || typeof item.provider !== "string" || typeof item.model !== "string") return void 0;
			const effort = optionalString(item.reasoningEffort);
			return {
				provider: item.provider,
				model: item.model,
				...effort === void 0 ? {} : { reasoningEffort: effort }
			};
		}
		function decodeModelSwitchSettings(value) {
			const item = record(value);
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
			return {
				getSnapshot,
				subscribe: (listener) => source.subscribe(listener),
				set: (field, value) => source.set(ownerField(field), value),
				unset: (field) => source.unset(ownerField(field))
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
		//#region src/client/main-row-controller.ts
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
				input.loadCatalog().then((value) => {
					if (live) setGroups(value);
				}).catch(() => {
					if (live) setMessage(input.t("catalogFailed"));
				});
				return () => {
					live = false;
				};
			}, [input.loadCatalog, input.t]);
			const { providers, models, efforts } = deriveMainChoices(groups, draft);
			const disabled = main.status !== "ready" || !main.writable || draft === void 0 || busy || draft.provider.trim() === "" || draft.model.trim() === "";
			const setProvider = (provider) => setDraft((current) => {
				if (current === void 0) return current;
				const first = groups.find((item) => item.id === provider)?.models[0];
				return {
					provider,
					model: first?.id ?? current.model,
					...first?.reasoning?.defaultEffort === void 0 ? {} : { reasoningEffort: first.reasoning.defaultEffort }
				};
			});
			const setModel = (id) => setDraft((current) => {
				if (current === void 0) return current;
				const selected = groups.find((item) => item.id === current.provider)?.models.find((item) => item.id === id);
				return {
					provider: current.provider,
					model: id,
					...selected?.reasoning?.defaultEffort === void 0 ? {} : { reasoningEffort: selected.reasoning.defaultEffort }
				};
			});
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
		const css = ".djvrPG_section{max-width:720px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:12px;display:flex;container-type:inline-size}.djvrPG_title{margin:0;font-size:16px;font-weight:500;line-height:24px}.djvrPG_intro{color:var(--dsw-alias-label-tertiary);margin:0;font-size:14px;line-height:22px}.djvrPG_saved{color:var(--dsw-alias-state-success-primary);align-items:center;gap:6px;margin:0;font-size:12px;line-height:18px;display:flex}.djvrPG_savedDot{background:currentColor;border-radius:50%;width:7px;height:7px}.djvrPG_group{flex-direction:column;gap:8px;margin-top:8px;display:flex}.djvrPG_groupLabel{color:var(--dsw-alias-label-tertiary);margin:0 2px;font-size:12px;font-weight:500;line-height:18px}.djvrPG_routeCard{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none;transition:border-color .16s,background .16s}.djvrPG_routeCard:hover{border-color:var(--dsw-alias-label-dimmed)}.djvrPG_routeCardOpen{border-color:var(--dsw-alias-label-dimmed);background:var(--dsw-alias-bg-layer-2)}.djvrPG_routeCardUnavailable{opacity:.72}.djvrPG_routeHeader{width:100%;min-height:66px;color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:11px 16px;display:flex}.djvrPG_routeHeader:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.djvrPG_routeHeader:disabled{cursor:default}.djvrPG_routeIcon{background:var(--dsw-alias-bg-module-platform);width:32px;height:32px;color:var(--dsw-alias-label-secondary);border-radius:10px;flex:none;place-items:center;display:grid}.djvrPG_routeCopy{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}.djvrPG_routeName{color:var(--dsw-alias-label-primary);align-items:center;gap:7px;font-size:14px;font-weight:500;line-height:22px;display:flex}.djvrPG_routeSummary{color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:18px;overflow:hidden}.djvrPG_badge{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;flex:none;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.djvrPG_badgeWarn{color:var(--dsw-alias-state-warn-label)}.djvrPG_chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.djvrPG_routeCardOpen .djvrPG_chevron{transform:rotate(180deg)}.djvrPG_cardBody{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding:14px 0 8px}.djvrPG_formGrid{grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;display:grid}.djvrPG_field{flex-direction:column;gap:6px;min-width:0;display:flex}.djvrPG_fieldFull{grid-column:1/-1}.djvrPG_fieldLabel{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500;line-height:18px}.djvrPG_input{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);appearance:none;background-color:var(--dsw-alias-bg-layer-1);width:100%;height:32px;color:var(--dsw-alias-label-primary);font:inherit;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2381858C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\");background-position:right 10px center;background-repeat:no-repeat;border-radius:8px;padding:0 32px 0 10px;font-size:14px;line-height:22px}.djvrPG_textInput{background-image:none;padding-right:10px}.djvrPG_input:focus{border-color:var(--dsw-alias-brand-primary);outline:none}.djvrPG_input:disabled{opacity:.6;cursor:default}.djvrPG_hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:18px}.djvrPG_warning{color:var(--dsw-alias-state-warn-label)}.djvrPG_message{flex:1;min-width:0}.djvrPG_cardFooter{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;margin-top:14px;padding:12px 0 0;display:flex}.djvrPG_button{box-sizing:border-box;height:36px;font:inherit;cursor:pointer;border-radius:18px;justify-content:center;align-items:center;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex}.djvrPG_secondaryButton{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);background:0 0}.djvrPG_secondaryButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid)}.djvrPG_primaryButton{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);border:0}.djvrPG_primaryButton:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}.djvrPG_button:disabled{opacity:.4;cursor:default}.djvrPG_button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}@container (width<=420px){.djvrPG_formGrid{grid-template-columns:1fr}.djvrPG_routeHeader{padding-inline:12px}.djvrPG_cardBody{margin-inline:12px}.djvrPG_cardFooter .djvrPG_button{flex:1}}@media (prefers-reduced-motion:reduce){.djvrPG_routeCard,.djvrPG_chevron{transition:none}}";
		const tagId = "dsh-model-switch/ModelSwitchSettings.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-model-switch";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
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
				width: "17",
				height: "17",
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
				width: "17",
				height: "17",
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
				width: "17",
				height: "17",
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
				width: "17",
				height: "17",
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
			const [open, setOpen] = (0, react.useState)("main");
			const [subagentDraft, setSubagentDraft, resetSubagent] = useDraft(subagent);
			const [searchDraft, setSearchDraft, resetSearch] = useDraft(search);
			const [imageDraft, setImageDraft, resetImage] = useDraft(image);
			const [busy, setBusy] = (0, react.useState)();
			const [message, setMessage] = (0, react.useState)();
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
			const defaultEffort = routeDefaultEffort(groups, subagentRoute);
			const mainEffectiveEffort = draft?.reasoningEffort ?? routeDefaultEffort(groups, draft);
			const searchChoices = capabilityChoices(groups, searchDraft, props.capabilities.searchProviderAdapters.providers ?? [], "search");
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
			const subagentSummary = subagentDraft?.mode === "follow-main" ? props.t("subagentFollowMain") : compact(props.t("subagentFixed"), routeName(groups, subagentRoute), defaultEffort === void 0 ? props.t("providerDefaultShort") : compact(props.t("providerDefaultShort"), defaultEffort));
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
									}), subagentDraft.mode === "fixed" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
										label: props.t("provider"),
										value: subagentDraft.provider ?? "",
										disabled: busy === "subagent" || !subagent.writable,
										choices: subagentChoices.providers,
										onChange: (provider) => {
											const first = groups.find((group) => group.id === provider)?.models[0];
											setSubagentDraft({
												...subagentDraft,
												provider,
												...first === void 0 ? {} : { model: first.id }
											});
										}
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
										label: props.t("model"),
										value: subagentDraft.model ?? "",
										disabled: busy === "subagent" || !subagent.writable,
										choices: subagentChoices.models,
										onChange: (model) => {
											setSubagentDraft({
												...subagentDraft,
												model
											});
										}
									})] }) : null]
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
							props.capabilities.searchProviderAdapters.available ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RouteCard, {
								title: props.t("search"),
								summary: searchDraft === void 0 ? props.t("loading") : routeName(groups, searchDraft),
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
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: ModelSwitchSettings_module_css_default.formGrid,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
											label: props.t("provider"),
											value: searchDraft.provider,
											disabled: busy === "search" || !search.writable,
											choices: searchChoices.providers,
											onChange: (provider) => {
												const first = groups.find((group) => group.id === provider)?.models[0];
												setSearchDraft({
													provider,
													...first === void 0 ? {} : { model: first.id }
												});
											}
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
											label: props.t("model"),
											value: searchDraft.model,
											disabled: busy === "search" || !search.writable,
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
										disabled: capabilityDisabled("search", search, searchDraft),
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
								summary: unavailable("searchProviderAdapters"),
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
		const zh = {
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
			search: "Web 搜索",
			searchHelp: "继续使用官方 web_search；Model Switch 只在官方 Web Provider 层选择 Codex 模型。",
			image: "图像生成",
			imageHelp: "统一 generate_image 会调用所选 Codex 或 Grok Adapter；Provider 原有图片工具仍保留。",
			unavailable: "未接入",
			loading: "正在加载设置…",
			readonly: "设置为只读",
			requestFailed: "保存失败",
			catalogFailed: "无法加载模型目录。",
			conflict: "设置已在其他位置更改，请检查最新值后重试。",
			"reason.central-subagent-routing": "rc.2 没有全局子代理启动路由接口。",
			"reason.packaged-preset-roots": "rc.2 不支持插件提供额外 preset root。",
			"reason.tool-owner-suppression": "rc.2 没有工具所有者或来源抑制接口。",
			"reason.search-provider-adapters": "当前公开版本没有可按模型切换的搜索 Provider Adapter。",
			"reason.vision-provider-adapters": "尚无 Provider 注册可独立路由的 Vision Adapter。",
			"reason.image-provider-adapters": "当前公开版本没有图像生成 Provider Adapter。"
		};
		const en = {
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
			search: "Web search",
			searchHelp: "The official web_search tool remains in place; Model Switch selects the Codex model only at the official Web provider seam.",
			image: "Image generation",
			imageHelp: "The stable generate_image tool calls the selected Codex or Grok Adapter; existing provider image tools remain available.",
			unavailable: "Unavailable",
			loading: "Loading settings…",
			readonly: "Settings are read-only",
			requestFailed: "Save failed",
			catalogFailed: "Could not load the model catalog.",
			conflict: "Settings changed elsewhere. Review the latest values and retry.",
			"reason.central-subagent-routing": "rc.2 exposes no global Subagent start-routing seam.",
			"reason.packaged-preset-roots": "rc.2 exposes no plugin-owned preset root.",
			"reason.tool-owner-suppression": "rc.2 exposes no tool owner or provenance suppression seam.",
			"reason.search-provider-adapters": "This release exposes no model-selectable Search provider adapter.",
			"reason.vision-provider-adapters": "No Provider has registered an independently routable Vision Adapter.",
			"reason.image-provider-adapters": "This release exposes no image-generation provider adapter."
		};
		//#endregion
		//#region src/client/index.tsx
		const name = "dsh-model-switch-client";
		const inject = [
			"slots",
			"locale",
			"settingsScope",
			"connection"
		];
		function apply(ctx) {
			const localeNamespace = "settings.model-switch";
			ctx.effect(() => ctx.locale.register(localeNamespace, {
				zh,
				en
			}), "dsh-model-switch: localized Settings section");
			const t = ctx.locale.bind(localeNamespace);
			const connection = ctx.get("connection");
			const main = ctx.settingsScope.bind({
				namespace: MAIN_SETTINGS_ID,
				decode: decodeMainSettings
			});
			const owned = ctx.settingsScope.bind({
				namespace: MODEL_SWITCH_SETTINGS_ID,
				decode: decodeModelSwitchSettings
			});
			const subagent = deriveSettingsScope(owned, deriveSubagentSettings, SUBAGENT_SETTINGS_FIELDS);
			const search = deriveSettingsScope(owned, deriveSearchSettings, SEARCH_SETTINGS_FIELDS);
			const image = deriveSettingsScope(owned, deriveImageSettings, IMAGE_SETTINGS_FIELDS);
			const saveMain = async (next, expectedRevision) => {
				const result = await connection.api.settings.mutate({
					ns: MAIN_SETTINGS_ID,
					expectedRevision,
					ops: [
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
					]
				});
				if (!result.result.ok) {
					if (result.result.error.code === "settings-conflict") throw new MainSettingsConflictError(t("conflict"));
					throw new Error(result.result.error.code + ": " + result.result.error.message);
				}
				return result.result.value.revision;
			};
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
					loadCatalog: async () => {
						const response = await connection.api.llm.models({});
						if (!response.result.ok) throw new Error(t("catalogFailed"));
						return response.result.value.groups;
					}
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
