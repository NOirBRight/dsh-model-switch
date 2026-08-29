# Model Switch — frozen product scope

**Model Switch** is a coordinated plugin-only DSH product for explicit model routing. Product, package, bundle, and settings-page identity remain **Model Switch** / `dsh-model-switch`. It may replace independently packaged DSH modules through name-matched public disable-and-insert patches and may extend self-maintained provider plugins, but never edits DSH Core, official package files, or production during acceptance.

## Routes

- **Default Main:** provider, model, and optional effort. It uses the public Settings namespace and is copied only into newly created sessions; existing sessions are never migrated or selected through the session picker.
- **Default Subagent:** `follow-main` or a fixed provider/model/effort. Follow-main resolves the immediate parent's latest request header, then global Main, and injects the route before official descriptor creation. Local spawn, fork, continuable, and workflow children use this policy unless workflow explicitly supplies provider/model. DSH 0.1.2-alpha.1 carries fixed effort in child `AgentOptions`; on rc.2, the provider default effort applies because that runtime has no child effort field. Remote Codex/Claude children are outside unified routing.
- **Search Router:** does not register or replace `web_search`. Model Switch registers one public `WebSearchProvider` with id `model-switch`; the existing official `web_search` continues through `ctx.web`, whose configured search provider must be `model-switch`. The thin provider selects the configured backend adapter and model at execution time and returns the official `WebSearchResult` unchanged. v0.2.0 supports Codex Search only. `web_fetch` and its configured provider remain unchanged.
- **Vision:** excluded. Model Switch exposes no Vision setting, does not shadow `read_image`, and does not preprocess chat attachments.
- **Image Router:** owns a new, uniquely named stable `generate_image` tool. It selects the configured Codex or Grok adapter/model at execution time, rejects backend-incompatible fields, and returns normalized image metadata. Existing provider-specific image tools remain available as rollback paths.
- **Composer Picker:** replaces the composer model seat with a suffix-grouped Model / Effort / Context / Fast / Thinking picker and submits through the official Model Directory. Picker changes are session-local. On a Host version that also persists session selection as the deployment default, the plugin restores the pre-switch Main default through the public Settings RPC with a revision fence; a concurrent Settings-page edit wins.
- **Plan Review:** intercepts the official `plan-review` composer takeover with a header execution-model picker and right-aligned Discuss in chat / Reject / Confirm actions. Confirm commits the selected model before answering.

Model choices are capability-driven. Invalid, unavailable, or unsupported selections remain visible to configuration surfaces and fail loudly at use; routing never silently falls back.

## Preset modes

Official `agent-presets` stay in the process. A nested `ctx.plugin(AgentPresets)` from this package would load a second `@deepseek-ai/dsh-scope` identity, so `session.create` fails with an unscoped-context refusal. Preset delegation tools already resolve the replacement `subagents` service after the Subagent Loader row is replaced. Model Switch ships no preset roots and leaves the official presets unchanged.

## Settings and lifecycle

The settings surface aggregates public Settings namespaces, reads and mutates with optimistic revisions, and saves rows independently. Every registration, watcher, and dynamic tool generation has clean disposal. All visible copy lives in zh/en locale dictionaries.

## Exclusions

No compaction, title, fetch routing, fallback, load balancing, provider credentials, CLI/API, configuration history, or DSH Core edits. Coordinated changes are limited to Model Switch and self-maintained provider plugins. Installing this package replaces a standalone `dsh-composer-picker` install; keep only one composer model seat.

Official `settings.section` has no icon field. The Settings nav glyph is a label-matched DOM swap, the same published pattern as usage-monitor, until an official icon seam exists. The `external-agents.plan-review.continue-in-dsh` child slot remains registered for dual-install; this package's Plan Review takeover currently wins (priority -7) because rc.2 has no public Plan-resolution seam.

## Delivery architecture

The package foundation and pure deep modules remain the policy/test surface. Runtime delivery disables the independent Subagent Loader row with its official name and inserts a uniquely identified replacement. Official AgentPresets stay mounted so they share the process `dsh-scope` identity. Search uses the released `ctx.web.registerSearchProvider()` seam so official tool ownership is preserved. Image uses a unique tool name and provider-owned authenticated adapters. Self-maintained Codex/Grok plugins register optional adapters through the public Model Switch service when present; standalone provider behavior is unchanged. Vision remains disabled. Replacement modules preserve the official public interfaces and fail closed when compatibility or capability validation fails.
