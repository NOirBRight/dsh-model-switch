# Model Switch implementation plan

## Milestone 1 — package and pure routing core

1. Establish the publishable package, strict TypeScript declaration build, ESM bundle, and fail-closed Cordis entry.
2. Preserve the released Main/Subagent deep modules. Add two confirmed v0.2 seams: a `ModelSwitchSearchProvider` implementing the official `WebSearchProvider` interface over a provider adapter registry, and a stable `generate_image` tool over an Image adapter registry. Keep Vision outside runtime delivery.
3. Gate an actual tarball: load every export target from extraction; reject source, tests, scripts, source maps, patch/diff payloads, Core paths/fork contracts, and local dependency protocols.
4. Prove emitted artifacts reproduce from different checkout paths.

**Completion:** `pnpm run check` and `git diff --check` pass. No DSH runtime, UI, preset, or lab changes occur.

## Milestone 2 — released runtime seams

Register each feasible Settings/runtime capability only through released public Cordis/DSH interfaces, and expose every unavailable route as explicit capability data rather than simulated behavior. Contract-test against clean rc.2 infrastructure rather than a hand-built context alone.

**Implemented foundation on rc.2:** Model Switch owns its Settings namespace; Main reads/saves through the official Agent Default Model service; registration, committed updates, Main delegation, and disposal are covered by a real Cordis + Settings composition test.

**Implemented coordinated replacement:** the package bundle patch disables the released Loader row with id `subagent` and inserts the uniquely identified plugin-owned `dsh-model-switch/subagent-runtime`; removing the bundle restores the official profile composition. The replacement subclasses the released rc.2 `SubagentRuntime`, selects provider/model before delegating to official one-shot and continuable descriptor creation, and fails closed for partial routes, ambiguous/unexpected rows, and explicitly configured Subagent effort because rc.2 has no released one-shot/cold-resume effort snapshot seam; inherited Main/parent effort is omitted while provider/model still follow the active route. Do not replace the launcher-pinned AgentPresets row: a nested AgentPresets instance loads a second dsh-scope identity and breaks session.create. Official presets consume the replacement `subagents` service after the Subagent Loader row is replaced. Search must use the released Web provider seam rather than registering a duplicate tool; Image may register only the unique `generate_image` name.

Known seam constraints from rc.2 inspection:

- Web session creation has no atomic create-time model override; use the existing public Main Settings namespace rather than post-create selection. rc.2 couples `session.selectModel` to a deployment-default write, so the owned composer/Plan picker restores the captured Main default through `settings.mutate` at the immediately following revision; conflicts are left untouched so concurrent Settings edits win.
- Tool registration has disposal but no atomic replacement; stage complete generations and roll back on registration failure.
- A later child model switch cannot rewrite its durable continuable descriptor; creation snapshots remain authoritative.
- Search routing owns only provider id `model-switch`; the deployment profile pins `web.searchProvider: model-switch` while preserving its existing `fetchProvider`. The official `web_search` and `web_fetch` tools are untouched.
- `generate_image` is unique, so existing provider-specific image tools remain enabled and require no owner suppression.
- Codex registers Search and Image adapters; Grok registers Image only. Optional Cordis injection preserves standalone provider behavior and disposal.
- Vision remains outside runtime delivery and must not register or shadow `read_image`.

## Milestone 3 — settings surface

Contribute the Model Switch settings section through declared client slots (rc.2 has no generic standalone page registry). Use one lifecycle controller/store, three derived prop shares, plain presentation data/callbacks, optimistic revisions, independent row saves, capability filtering, and zh/en dictionaries.

## Milestone 4 — provider adapters and composition

Keep the launcher-pinned `agent-presets` row and official web tools. Add clean optional adapter releases to Codex and Grok without Vision or hard runtime dependency cycles. Configure Lab `web.searchProvider` to `model-switch` while preserving `fetchProvider`; removing Model Switch restores the prior provider pin. Model Switch ships no preset copies.

## Milestone 5 — pack/profile/lab acceptance

Run the full composition matrix from packed artifacts under `DSH_HOME=~/.dsh-lab` on port 3082. Validate boot, HTTP, profile composition, and artifact hashes; leave browser-only visual checks to the human because the managed browser must not open DSH itself.
