//#region lib/types/adapter-registry.js
function providerId(value, label) {
	if (value.trim() === "") throw new Error(label + " must be a non-empty string");
	return value;
}
/** Lifecycle-owned registry for optional provider integrations. */
var ModelSwitchAdapterRegistry = class {
	entries = /* @__PURE__ */ new Map();
	listeners = /* @__PURE__ */ new Set();
	subscribe(listener) {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}
	changed() {
		for (const listener of this.listeners) listener();
	}
	/** Explicit projection: never serialize an executable adapter or its extra fields. */
	searchCatalog() {
		return this.list().flatMap(({ search }) => {
			if (search === void 0) return [];
			const models = (search.models ?? []).filter((model) => search.supportsModel(model.id)).map((model) => ({
				id: providerId(model.id, "search model id"),
				name: providerId(model.name, "search model name")
			}));
			return [{
				id: search.provider,
				name: search.label ?? search.provider,
				models
			}];
		});
	}
	register(adapters) {
		const provider = providerId(adapters.provider, "provider");
		if (adapters.search !== void 0 && adapters.search.provider !== provider) throw new Error("search adapter provider must match registration provider");
		if (adapters.image !== void 0 && adapters.image.provider !== provider) throw new Error("image adapter provider must match registration provider");
		if (this.entries.has(provider)) throw new Error("provider adapters already registered: " + provider);
		this.entries.set(provider, adapters);
		this.changed();
		let active = true;
		return () => {
			if (!active) return;
			active = false;
			if (this.entries.get(provider) === adapters) {
				this.entries.delete(provider);
				this.changed();
			}
		};
	}
	get(provider) {
		return this.entries.get(provider);
	}
	list() {
		return [...this.entries.values()];
	}
};
//#endregion
export { ModelSwitchAdapterRegistry };
