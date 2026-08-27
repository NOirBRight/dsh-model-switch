# Model Switch

Model Switch (`dsh-model-switch`) is a plugin-only router for Main, local Subagents, official Web Search, and image generation, plus the composer/Plan model picker.

The package ships pure routing modules, a Cordis Host service, and a localized Client Settings section. Main defaults save atomically through the released Settings RPC and affect new sessions only. The Subagent replacement changes only provider/model before delegating to the official rc.2 implementation; follow-main reads the active parent request before stale session options. Search keeps the official `web_search` tool and routes only at the released `WebSearchProvider` seam through the selected Codex adapter. The unique stable `generate_image` tool routes through Codex or Grok adapters while existing provider-specific image tools stay available. Vision, `read_image`, ordinary chat attachments, `web_fetch`, and official AgentPresets remain unchanged. Missing adapters, unsupported models, and partial routes fail explicitly without fallback.

## Public module foundation

- capability-aware `ModelSelection` validation and default effort resolution
- versioned Main settings copied only for new sessions
- follow-main/fixed subagent route snapshots with workflow override and cold restore
- official `web_search` ownership with a `model-switch` thin Search provider and Codex adapter
- stable `generate_image` routing through provider-owned Codex/Grok adapters
- Vision, image reading, chat attachments, and `web_fetch` left unchanged

See [PRODUCT.md](PRODUCT.md) for frozen scope and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for staged integration and exact rc.2 seam constraints. [SPEC.md](SPEC.md) is retained only as superseded history.

## Installation

```sh
DSH_HOME=~/.dsh dsh plugin --profile web add github:NOirBRight/dsh-model-switch#v0.3.6
DSH_HOME=~/.dsh dsh plugin --profile web add github:NOirBRight/dsh-llm-codex#v0.3.0
DSH_HOME=~/.dsh dsh plugin --profile web add github:NOirBRight/dsh-llm-grok#v0.3.0
```

Pin the profile's existing `web` row to `searchProvider: model-switch` while preserving its current `fetchProvider`; Model Switch never replaces `web_fetch`. Configure Search/Image routes in Settings, then restart the selected profile. If the profile already has `dsh-composer-picker`, remove it so only this package owns the composer model seat. Production profiles must use released GitHub tags rather than local workspace dependencies.

## Development

Requires Node 22.19+ and pnpm.

```sh
pnpm install
pnpm run check
```

`check` builds declarations plus Host and Client bundles, runs unit and real Cordis/Settings composition tests, validates every export from an extracted tarball, and rebuilds under different filesystem roots to prove reproducibility.
