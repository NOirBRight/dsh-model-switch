# Model Switch

English | [中文](README.zh.md)

Choose one explicit route for Main, Subagents, Web Search, image generation, the active conversation, and Plan execution in DeepSeek Harness. Model Switch uses public DSH services and provider-owned adapters; it does not patch DSH Core or manage provider credentials.

<p align="center"><img src="docs/screenshots/composer-picker.png" alt="Composer Picker with Model, Effort, Context, and Fast controls" width="314"></p>

## Routes

| Route | Behavior |
| --- | --- |
| Main model | Default provider, model, and optional effort for newly created sessions. Existing sessions are not migrated. |
| Subagent | Follow the active parent route, or use a fixed provider/model/effort. Workflow overrides remain authoritative. |
| Composer Picker | Changes only the active session and submits the exact catalog model id. Main defaults are preserved. |
| Plan Review | Chooses the execution model before the Plan approval response is sent. |
| Web Search | Keeps official `web_search`; after deployment opt-in, routes through the selected, dynamically declared provider search adapter. |
| Image generation | Provides one stable `generate_image` tool routed through a selected Codex or Grok adapter. |

Invalid, unavailable, or unsupported routes fail explicitly. Model Switch never silently falls back to another provider or model.

After the active session successfully opens a native Antigravity session, the Composer and Plan Review pickers disable other providers for that session while keeping Antigravity model and effort controls available. The DSH global picker lock remains authoritative.

## Configure Main and Subagents

Open **Settings → Model Switch**. Main changes affect new sessions only. Subagents may follow Main or use a fixed provider, model, and effort.

Changing the Main or fixed Subagent provider/model replaces the previous model's effort with the target model's default. Models without reasoning support receive no effort.

![Model Switch settings with a fixed Subagent route](docs/screenshots/settings-subagent.png)

Follow Main resolves the active parent request first, then the configured Main default. A fixed route is injected before the official Subagent descriptor is created. DSH 0.1.2-alpha.4 carries provider, model, and fixed reasoning effort in that descriptor.

## How custom models appear in the Picker

Model Switch does not turn an arbitrary string in its own settings into a model. A provider plugin must publish the model to the official DSH model catalog first:

```text
Provider configuration
→ provider publishes model rows to the DSH catalog
→ the active session Model Directory exposes provider/model metadata
→ Model Switch groups those catalog rows
→ the Picker submits the original provider id and model id
```

The catalog supplies the provider name, model id/name, reasoning efforts, and default effort. A saved route that is no longer present remains visible as unavailable in Settings; the Picker does not pretend it is routable.

### Variant id grammar

Model Switch groups catalog rows by provider and by the model id after peeling these suffixes:

| Catalog model id | Picker variant |
| --- | --- |
| `acme-v1` | Standard row |
| `acme-v1-fast` | Fast |
| `acme-v1-128k` | Context 128K |
| `acme-v1-1m` | Context 1M |
| `acme-v1-1m-fast` | Context 1M + Fast |

Rules:

- `-fast` creates the Fast axis.
- `-<n>k` and `-<n>m` create Context tiers; suffixes may be combined with `-fast` in either order.
- `reasoning.efforts` creates the Effort choices; `reasoning.defaultEffort` selects the initial value.
- Switching Fast, Context, or Thinking variants keeps the current effort only when the target catalog row supports it; otherwise the target row's default effort (or no effort) is used.
- Reasoning metadata marks a catalog row as Thinking-capable.
- Unrecognized ids remain independent model families; Model Switch never drops them.

To support a combined selection, the provider must publish the combined row. Publishing only `acme-v1-fast` and `acme-v1-1m` cannot represent Fast + 1M; publish `acme-v1-1m-fast` as well. The Picker never synthesizes a model id that the provider did not publish.

## Plan Review

Plan Review owns an execution-model draft separate from Main. **Confirm** first commits that model to the active session, then answers the pending Plan review. A failed model commit leaves the review pending and retryable. **Reject** and **Discuss in chat** do not execute the Plan.

![Plan Review with an execution-model picker](docs/screenshots/plan-review.png)

## What Model Switch does not change

- `web_fetch` and its configured provider
- Vision routing, `read_image`, and ordinary chat attachments
- Provider login, credentials, or provider settings cards
- Official Agent Presets
- Existing provider-specific image tools
- Existing sessions when the Main default changes

## Installation

Install Model Switch and only the provider adapters you use. The coordinated versions below target the verified DSH 0.1.2-alpha.4 and 0.1.2-rc.1 runtimes:

```sh
DSH_HOME=~/.dsh dsh plugin --profile web add github:NOirBRight/dsh-llm-providers-ui#v0.1.9
DSH_HOME=~/.dsh dsh plugin --profile web add github:NOirBRight/dsh-llm-codex#v0.3.14
DSH_HOME=~/.dsh dsh plugin --profile web add github:NOirBRight/dsh-llm-grok#v0.3.11
DSH_HOME=~/.dsh dsh plugin --profile web add github:NOirBRight/dsh-model-switch#v0.4.7
```

### Search routing (0.4.7)

Providers declare independent search adapters and model metadata on the existing Host `ModelSwitchAdapterRegistry`. The browser receives only id/name/model metadata over authenticated Connection RPC, not adapters or credentials. Registration/unload updates subscribers; in-place catalog changes are picked up by the bounded 20-second heartbeat. `ProviderDirectory` remains the client role/usage owner, not a second Host execution registry.

DeepSeek uses the official public `DeepSeekSearchProvider`, the existing `web-search-deepseek` settings and credential service. Codex uses its existing ChatGPT credentials; Grok uses its existing subscription token and provider-owned Responses search. Native conversational networking alone does not create a search option. Missing credentials, invalid settings, unsupported models and unavailable adapters fail explicitly, without fallback.

**Registering an adapter does not select the global Web route.** Installation leaves the deployment's existing Web configuration untouched. To opt in, set the existing Web entry's `searchProvider` to `model-switch` while retaining **every other existing config field**, especially `fetchProvider`. DSH id-targeted patches replace the entire config rather than deep-merging it: copy the complete effective config from `dsh --profile web --dump-config`, then change only searchProvider in the deployment/user patch. Do not copy an assumed `fetchProvider: http` over a custom pin.

After opting in, configure the requested search provider/model in Model Switch Settings. No complete supported route means `WEB_PROVIDER_CONFIGURED_UNAVAILABLE` through the official selector; there is no automatic DeepSeek fallback. Without the global pin, the dropdown does not control `web_search`. An unpinned Web service can become ambiguous when multiple search providers are usable. Before uninstalling Model Switch, restore the deployment's prior search pin; otherwise the official selector correctly reports a missing configured provider. The official `web_search` and `web_fetch` tools are never replaced.

Release-aligned search regression: `DSH_RELEASE_ANCHOR=/path/to/official/install/package.json pnpm exec vitest run --config tests/vitest.release.config.ts`. See [search audit and acceptance](docs/search-provider-audit.md) for exact baselines, dependencies and live status.

If `dsh-composer-picker` is installed, remove it from the profile before enabling Model Switch. Model Switch already owns the Composer Picker and Plan Review seat; two owners produce duplicate or competing UI.

Production profiles must use released GitHub tags rather than workspace-local dependencies. Restart the selected DSH profile after installation or route changes.

## Compatibility

Verified runtimes are DeepSeek Harness `0.1.2-alpha.4` and `0.1.2-rc.1` on Cordis `4.0.2`; this record is evidence, not an allowlist.

Unknown newer runtimes are attempted on a best-effort basis after one warning, and the plugin keeps its normal mount path.

A reproduced failure is blocklisted only afterward; see the [compatibility records](package.json) for the affected version, reason, and evidence.


## Development

Requires Node 22.19+ and pnpm.

```sh
pnpm install
pnpm run check
```

`check` builds Host and Client artifacts, runs unit and Cordis/Settings composition tests, validates the extracted package, and verifies reproducible bundles. Product scope is defined in [PRODUCT.md](PRODUCT.md); implementation constraints live in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## Release installation (Latest)

Explicit model routing for Main, Subagent, Composer, Plan Review, and capability tools. The release artifact targets the verified runtimes listed above and contains built Host/Client files only; it has no sibling-repository source, workstation path, or local protocol dependency.

Latest installation (the URL never contains a version):

~~~sh
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-model-switch/releases/latest/download/dsh-model-switch.tgz
~~~

Fixed-version installation:

~~~sh
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-model-switch/releases/download/v0.4.7/dsh-model-switch.tgz
~~~

Update, uninstall, and verify:

~~~sh
# Update to the latest Release
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-model-switch/releases/latest/download/dsh-model-switch.tgz
# Verify the loaded version
dsh plugin --profile web list
dsh plugin --profile web doctor
# Uninstall only this plugin
dsh plugin --profile web remove dsh-model-switch
~~~

Configuration: use the plugin section in Settings for Web UI plugins, or the profile dsh.profile.bundles entry for Host-only plugins. Start with this README's minimal YAML/JSON example and provide credentials/backend addresses explicitly.

Rollback: rerun the fixed v0.4.4 command, verify the profile list, then restart the Web service once. Inspect journalctl --user -u dsh-web.service and dsh plugin --profile web doctor; never put a source checkout in the production profile.

Release and integrity: [v0.4.6](https://github.com/NOirBRight/dsh-model-switch/releases/tag/v0.4.6) · [SHA256SUMS](https://github.com/NOirBRight/dsh-model-switch/releases/download/v0.4.7/SHA256SUMS).
