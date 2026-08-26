//#region lib/types/adapter-registry.js
function providerId(value, label) {
	if (value.trim() === "") throw new Error(label + " must be a non-empty string");
	return value;
}
/** Lifecycle-owned registry for optional provider integrations. */
var ModelSwitchAdapterRegistry = class {
	entries = /* @__PURE__ */ new Map();
	register(adapters) {
		const provider = providerId(adapters.provider, "provider");
		if (adapters.search !== void 0 && adapters.search.provider !== provider) throw new Error("search adapter provider must match registration provider");
		if (adapters.image !== void 0 && adapters.image.provider !== provider) throw new Error("image adapter provider must match registration provider");
		if (this.entries.has(provider)) throw new Error("provider adapters already registered: " + provider);
		this.entries.set(provider, adapters);
		let active = true;
		return () => {
			if (!active) return;
			active = false;
			if (this.entries.get(provider) === adapters) this.entries.delete(provider);
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
