# SUPERSEDED — historical Model purposes draft

> **Do not use this document as product or implementation authority.** It is retained only as historical context and is superseded by [PRODUCT.md](PRODUCT.md) and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). The current product is **Model Switch**, and the frozen scope explicitly excludes several features proposed below.

# Model purposes

Product name: **Model purposes**（模型用途）. Repository: `dsh-model-switch`.

This spec is the locked design for a DeepSeek Harness options area. It does not change `deepseek-harness` by itself.

## Problem Statement

The composer model picker and the deployment default do not control what model actually runs when the product starts an in-process child, writes a session title, compresses history, or searches the web.

Today a child copies the parent's create-time `AgentOptions`, so switching the picker to another model can still spawn children on the frozen default. The `subagent` tool has no way to pick a capability tier. `workflow.agent()` can pass raw provider and model ids, which bypasses any user table. Title and compaction already support follow-or-pin in plugin YAML, but that is not a Settings page. Web search/fetch provider selection lives in composition YAML; Codex's chat-adapter card exposes a search model only because there is no product home for search.

Switching the live session to a much smaller context window can strand the session: the next request overflows, and compaction then runs on the small model that cannot ingest the current occupancy. The conventional picker just switches. A compact-on-downswitch pipeline is useful but must not be mandatory, and must not invent a new segmented summarizer.

## Solution

One settings page, **Model purposes**, groups several existing and new Settings namespaces. It is a UI grouping, not one YAML document.

- **Child routing policy** (new): mutually exclusive `inherit` | `pin` | `tiers`. New installs default to `inherit`. Inherit follows that parent session's live picker selection (in-process selection, else latest `request/header`, else `AgentOptions`), including effort, and freezes the route when the child starts. Pin is one user-owned provider/model pair with optional effort. Tiers map `fast` | `default` | `strong` to exact pairs; the parent may pass `tier` only in this mode; omitting `tier` uses `default`. The tool parameter is named `tier`, not `slot`.
- **Title** and **compaction summarizer**: follow the same live session selection, or pin a pair. No tiers. Compaction UI edits only the global summarizer pair.
- **Search / fetch**: Settings for which web search provider and fetch provider run `web_search` / `web_fetch`. When the selected search provider owns a search-model field, that field is edited on this row. This page is the home; chat-adapter cards are not.
- **Compact on downswitch** (optional, default off): when on, `selectModel` to a smaller window either switches immediately if occupancy fits, or runs one compaction with the previous model, then switches if it fits, otherwise refuses the switch (any landed checkpoint stays). No segmented loop. A busy session refuses the switch. This path ignores the ordinary summarizer pin so the warm prefix can be reused.

All in-process child starts share one resolver: `subagent`, `subagent_fork`, and `workflow.agent()`. External product workers are unchanged. Composition `tool-subagent` `agentOptions` no longer pins in-process child models. `workflow.agent()` drops raw provider/model ids.

## User Stories

1. As a user, I want a Model purposes settings page, so that child, title, compaction, search, and downswitch choices live in one place instead of YAML and adapter cards.
2. As a new-install user, I want child routing to default to inherit, so that children follow the model I am already chatting with.
3. As a user who switches the composer picker mid-session, I want the next in-process child to use that live selection, so that spawn does not stay on the create-time default.
4. As a user who has not yet sent a turn after switching models, I want inherit to still see the in-process selection, so that I do not have to wait for a `request/header` before delegating.
5. As a user of a blank session that never used the picker, I want inherit to fall back to the parent's `AgentOptions`, so that the first child still has a route.
6. As a user, I want inherit to copy the live effort as well as provider and model, so that children match the intensity I picked.
7. As a user, I want inherit to read the immediate parent's live selection, so that a nested child follows its parent child rather than jumping to the root picker.
8. As a user, I want a child's route frozen at start, so that changing the picker or the policy does not migrate a running or continuable child.
9. As a user, I want to pin every in-process child to one model, so that cheap or strong children do not depend on whatever I am chatting with.
10. As a user pinning a child model, I want an optional effort, so that I can lock intensity or leave the pinned model's own default.
11. As a user, I want three named tiers (`fast`, `default`, `strong`) mapped to exact models I choose, so that the parent can pick capability without seeing live provider ids.
12. As a user, I want `default` the tier to be distinct from inherit, so that omitting `tier` does not silently follow the parent.
13. As a user, I want to leave unused pin or tier fields in the document when I switch mode, so that I can return to a previous table without retyping it.
14. As a user, I want saving `tiers` without three complete pairs to fail, so that I cannot enable a broken table.
15. As a user, I want saving `pin` without a provider/model pair to fail, so that pin cannot be empty.
16. As a parent model in inherit or pin mode, I do not want a `tier` argument on `subagent`, so that I cannot pretend to choose a tier the user did not enable.
17. As a parent model in tiers mode, I want an optional `tier` enum on `subagent` and `subagent_fork`, so that I can request fast, default, or strong.
18. As a parent model in tiers mode, I want omitting `tier` to use the `default` mapping, so that I do not have to guess difficulty.
19. As a parent model, I never want to pass raw provider or model ids for a child, so that I cannot invent routes the user did not configure.
20. As a parent model calling `workflow.agent()`, I want the same policy and the same optional `tier`, so that scripted fan-out cannot bypass the options page.
21. As a parent model calling `workflow.agent()` in inherit or pin mode, I want a passed `tier` to be ignored, so that flipping the radio does not crash old scripts.
22. As a user, I want `subagent` and `subagent_fork` to share the policy, so that fork versus spawn is a context choice rather than a second routing table.
23. As a user who pins a child model different from the parent, I still want `subagent_fork` available, so that I can fork even if the prefix cache is dropped.
24. As a user, I do not want per-tool-name tables (for example explore always fast) in v1, so that the radio stays mutually exclusive.
25. As a user, I want a later `explore` tool, if added, to remain a sibling `tool-subagent` instance that still uses this policy, so that it is not a hidden fourth strategy.
26. As a user, I want title generation to follow the live session model by default, so that titles match the conversation without a second picker.
27. As a user, I want to pin title generation to a small model, so that titling stays cheap.
28. As a user, I want compaction summarization to follow the live session model by default, so that ordinary pressure compaction reuses the current route.
29. As a user, I want to pin the compaction summarizer, so that everyday `/compact` and pressure compaction can use a dedicated model.
30. As a user, I do not want title or compaction to expose tiers, so that the parent model is not asked to classify those auxiliary calls.
31. As a user, I want title follow, compaction follow, and child inherit to share one definition of live session selection, so that “follow the session” means one thing.
32. As a user, I want compaction's per-target `modelPolicies` to stay in YAML, so that the page only edits the global follow-or-pin pair.
33. As a user, I want to choose which search provider backs `web_search`, so that I am not stuck with composition YAML or an adapter card.
34. As a user, I want to choose which fetch provider backs `web_fetch` independently, so that search and fetch can be different backends.
35. As a user who selected an LLM-backed search provider, I want to edit that provider's search model on the same row, so that Codex or DeepSeek search models have a product home.
36. As a user, I do not want enabling a search model on a chat-adapter card to be the way I turn search on, so that the chat card is not a fake search settings page.
37. As a user, I want compact-on-downswitch off by default, so that the picker behaves like today's product and like Claude Code.
38. As a user with the option off, I want `selectModel` to switch even when occupancy exceeds the new window, so that conventional switching is unchanged.
39. As a user with the option on, I want a switch that already fits the new window to happen immediately, so that I do not pay a compaction when none is needed.
40. As a user with the option on, I want a too-large occupancy to be compacted once with the previous model before switching, so that the small model is not asked to ingest the old context.
41. As a user with the option on, I want that downswitch compaction to ignore the ordinary summarizer pin, so that the previous model's KV prefix can be reused.
42. As a user with the option on, I want a switch refused if one compaction still does not fit, so that I am not moved onto a model that cannot run.
43. As a user whose downswitch compact ran but the switch was refused, I want the checkpoint to remain, so that history is smaller even though the model did not change.
44. As a user with the option on while a turn is running, I want `selectModel` refused rather than queued compact, so that compaction does not interleave with an active turn.
45. As a user, I do not want a segmented or map-reduce summarizer on downswitch, so that v1 does not add a second compaction protocol.
46. As a user, I want an unroutable pin or tier to fail that child, title, or compaction call, so that the product never silently falls back to inherit.
47. As a user, I want changing child mode to remount tool schemas, so that `tier` appears only while tiers is on, even if that drops the current KV prefix once.
48. As a headless user, I want the same Settings document to apply, so that Web and headless do not grow two routing tables.
49. As a deployment author, I want composition to supply inherit as the child-routing base layer, so that YAML is not a fourth child strategy via `agentOptions`.
50. As a user of external workers (`delegate_worker` and product CLIs), I want this page not to change those tools in v1, so that foreign CLIs keep their own model defaults.

## Implementation Decisions

- Product name is **Model purposes**. Child routing is one row on that page, not the name of the whole project.
- Child routing is a new Settings namespace and service, analogous to `agent-default-model`, not a field on that section and not only `tool-subagent` config.
- Settings shape for child routing (non-active mode fields are retained as drafts and ignored by the resolver):

```text
mode: inherit | pin | tiers   # default inherit
pin?: { provider, model, reasoningEffort? }
tiers?: {
  fast:    { provider, model, reasoningEffort? }
  default: { provider, model, reasoningEffort? }
  strong:  { provider, model, reasoningEffort? }
}
```

- One resolver turns (parent live `ModelSelection`, optional requested `tier`) into the child `ModelSelection`. Every in-process `subagents.start*` path, including workflow host starts, must call it. Tools do not each reimplement routing.
- Parent live selection is the Host stack for that session: in-process `selectModel`, else latest logged `request/header`, else parent `AgentOptions`. It does not fall back to the global `agent-default-model` (that default is for other sessions).
- Child `AgentOptions` / continuable descriptor receive the resolved pair at start and do not re-read the policy later.
- In-process `tool-subagent` composition `agentOptions` no longer supplies provider/model for spawn/fork. Optional `maxTokens` may remain if still required by the child loop.
- `workflow.agent()` deletes `provider` and `model`. Optional `tier` is accepted in tiers mode and ignored in inherit/pin.
- Tool JSON schema includes `tier` only while mode is `tiers`. Policy changes remount the tool. Inherit/pin must not declare a dead parameter.
- Title and compaction promote their follow-or-pin routes to Settings on the owning plugins. Empty pair means follow live session selection (the same reader inherit uses). Pin is that plugin's pair.
- Compaction Settings also carry `compactOnDownswitch` boolean, default false.
- Downswitch, when on, compares `projectedTokens` to the **target** model's `contextWindow`. If lower, assign the new selection. If not, `runMaintenance` one compaction using the **current** model as summarizer, then assign or refuse. Busy → refuse with no compact. Still over → refuse switch, keep checkpoints. No retry loop, no destination-retargeted multi-pass, no third compressor model.
- Web runtime `searchProvider` / `fetchProvider` become a Settings section. The options page edits them. Provider-owned search-model fields stay in those providers' namespaces but are presented on the search row. Relocating Codex's chat-card search control can ship in a later change in that plugin; this spec does not require a same-PR UI delete.
- ApiProxy must allowlist every new or newly user-edited Settings namespace the page writes.
- No new session event is required for the policy name: the child's logged `request/header` records the resolved route; a `tier` argument is already in the parent tool call when present.
- `SESSION_FORMAT_VERSION` does not bump.

## Testing Decisions

Good tests observe what the user or parent model can see: the Settings document, tool schemas, child `request/header` (or title/compaction purpose route), and `selectModel` success or refusal. They do not assert plugin registration order, listener identity, or helper names.

Prefer existing seams over new ones. The fewest honest seams:

1. **Child route resolver** (primary). Given a policy document and a parent live `ModelSelection`, the next in-process child start records the expected provider, model, and effort. Cover inherit (picker before header, header, `AgentOptions` fallback), pin, tiers with omitted/`fast`/`default`/`strong`, nested parent, freeze-at-start, unroutable failure, and workflow starts. Prior art: subagent child-option tests, tool-subagent forwarding tests, agent-default-model settings tests.
2. **Live tool schema**. After a Settings write to `tiers` or away from it, `subagent` / `subagent_fork` schemas gain or lose `tier`. Prior art: tool-subagent schema tests that already remount with provider lifecycle.
3. **`session.selectModel`**. Option off: oversize switch still accepted (current behavior plus images/routability checks). Option on: fit switches; one compact then switch; still-over refuses; busy refuses. Prior art: ApiProxy model-selection tests.
4. **Purpose follow/pin**. Title and compaction use the shared live reader or the pinned pair. Prior art: session-title-llm route tests, compaction-basic summarizer config tests.
5. **Web provider Settings**. Changing search/fetch ids changes which provider `ctx.web` runs. Prior art: web runtime provider-selection tests.

Assembled keyless snapshot: one headless (or example) run where the parent delegates under inherit after a live selection, so the child transcript shows the live model rather than the frozen default. Package tests do not replace that snapshot for the user-visible spawn behavior.

Do not add a second resolver for tests. If a test cannot go through `subagents.start*` or `session.selectModel` or the title/compaction generate helpers, the seam is wrong.

## Out of Scope

- External workers and `delegate_worker` / product-CLI model cards.
- Per-tool-name overrides (explore always `fast`).
- Automatic difficulty classification or OpenRouter-style routers.
- Segmented, hierarchical, or map-reduce compaction.
- Always-on downswitch gate (refuse switch when occupancy exceeds the target window) while the compact option is off.
- Rolling back successful compaction checkpoints.
- Compaction `modelPolicies` in the UI.
- Same-PR removal of Codex chat-card search (allowed as a follow-up in that plugin).
- Changing the root session model from the parent model.
- Raising `SESSION_FORMAT_VERSION`.

## Further Notes

DSH has no Explore tool today. `subagent` and `subagent_fork` are two instances of the same plugin bound to spawn versus fork. A future Explore would be a third instance, not a subset of `subagent`.

Claude Code also just switches models; users get stuck on a small window and must switch back, `/compact`, then switch again. This spec keeps that as the default and offers compact-on-downswitch as an opt-in.

Glossary:

- **Child routing policy** — inherit, pin, or tiers for in-process children.
- **Purpose** — auxiliary LLM call (title, compaction), not a model-facing tool.
- **Tier** — `fast` | `default` | `strong`.
- Avoid **slot** (already a UI contribution seat), **router**, and **difficulty**.

Related DeepSeek Harness decisions: session model selection stays session-local; default model is not written by the picker; fork children stay one-shot; web search/fetch are an explicit provider pair; compaction is a durable checkpoint transaction with no multi-pass rollback.
