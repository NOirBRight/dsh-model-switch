# Model Switch — frozen product scope

**Model Switch** is a coordinated plugin-only DSH product for explicit model routing. Product, package, bundle, and settings-page identity remain **Model Switch** / `dsh-model-switch`. It may replace independently packaged DSH modules through name-matched public disable-and-insert patches and may extend self-maintained provider plugins, but never edits DSH Core, official package files, or production during acceptance.

## Routes

- **Default Main:** provider, model, and optional effort. It uses the public Settings namespace and is copied only into newly created sessions; existing sessions are never migrated or selected through the session picker.
- **Default Subagent:** `follow-main` or a fixed provider/model. Follow-main resolves the immediate parent's latest `request/header`, then global Main, and injects the route before official descriptor creation. Local spawn, fork, continuable, and workflow children use this policy unless workflow explicitly supplies provider/model. rc.2 exposes neither child `AgentOptions.reasoningEffort` nor a cold-resume descriptor effort field, so follow-main preserves the parent's provider/model while using the child's provider-default effort; an explicitly configured Subagent effort remains unavailable and fails closed. Remote Codex/Claude children are outside unified routing.
- **Search, Vision, and Image tools:** excluded from this release because rc.2 has no released ownership seam that lets Model Switch safely replace agent-scoped tools. Model Switch exposes no settings or tools for these routes; official/provider search, image-reading, chat-attachment, and image-generation paths remain unchanged.

Model choices are capability-driven. Invalid, unavailable, or unsupported selections remain visible to configuration surfaces and fail loudly at use; routing never silently falls back.

## Preset modes

Official `agent-presets` stay in the process. A nested `ctx.plugin(AgentPresets)` from this package would load a second `@deepseek-ai/dsh-scope` identity, so `session.create` fails with an unscoped-context refusal. Preset delegation tools already resolve the replacement `subagents` service after the Subagent Loader row is replaced. Model Switch ships no preset roots and leaves the official presets unchanged.

## Settings and lifecycle

The settings surface aggregates public Settings namespaces, reads and mutates with optimistic revisions, and saves rows independently. Every registration, watcher, and dynamic tool generation has clean disposal. All visible copy lives in zh/en locale dictionaries.

## Exclusions

No compaction, title, fetch routing, fallback, tiers, load balancing, provider credentials, CLI/API, configuration history, Composer Picker integration, Plan Review contracts, session-picker default management, private DSH contracts, or DSH Core edits. Coordinated changes are limited to Model Switch and self-maintained provider plugins.

## Delivery architecture

The package foundation and pure deep modules remain the policy/test surface. Runtime delivery disables the independent Subagent Loader row with its official name and inserts a uniquely identified replacement. Official AgentPresets stay mounted so they share the process `dsh-scope` identity. Search, Vision, and Image capability routing remains disabled until released ownership and provider-adapter seams can preserve official/provider tools. Replacement modules preserve the official public interfaces and fail closed when compatibility or capability validation fails.
