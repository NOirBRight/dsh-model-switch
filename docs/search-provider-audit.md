# Search provider integration: pre-implementation audit

Status: interface checkpoint, not feature completion. No live search acceptance claimed.

## Baseline and dependencies

- New worktree: `/home/noirbright/Workstation/.worktrees/dsh-model-switch-search`, branch `agent/search-provider-unification`.
- Model Switch: common ancestor of `1bb555f` and `f1895ce` is `1ceb94f`. Baseline `f1895ce` preserves all ms11 Antigravity catalog/runtime-lock work. Only reviewed search patch `1bb555f` was cherry-picked as `bb6ae4a` (README, patch, patch test); no entire integration branch was cherry-picked.
- ProviderDirectory: `c79de2f` (v0.1.9), one commit ahead of original checkout `eaef99f`. Existing client directory owns role/usage registration and subscriptions, not host search execution. Keep it; extend the existing host ModelSwitchAdapterRegistry for executable search and publish only serializable metadata to clients. No third registry.
- Grok: `286e2df`, two commits ahead of `beae11a`; preserve deferred providerDirectory registration. Image adapter exists; native Responses web_search/x_search is not yet an independent search adapter. Provider-owned Responses reuse needs implementation and result-evidence tests, not merely a label.
- Codex: integration `05788b8` diverges from original `250ffa6`, merge-base `9815250`. Its `b0453b5` + `05788b8` registration changes must be reconciled onto `250ffa6` in a separate worktree to preserve newer catalog/usage changes. Do not use the old integration head alone as release baseline.
- Cursor, Ollama, CommandCode, OpenCode Go and ACP need no search edits in this scope; their integration branches remain untouched.

## Verified runtime

`systemctl --user show dsh-lab.service -p MainPID -p FragmentPath` returned PID 1048340. Reading only DSH_HOME from that process environment confirmed `/home/noirbright/.dsh-rc1-canary`. Unauthenticated GET `http://127.0.0.1:3082/` returned HTTP 401. This is not authenticated UI or search acceptance.

Original lab dependencies (not changed):

- dsh-model-switch: link:/home/noirbright/Workstation/dsh-model-switch
- dsh-llm-codex: link:/home/noirbright/Workstation/dsh-llm-codex
- dsh-llm-grok: link:/home/noirbright/Workstation/dsh-llm-grok
- dsh-llm-providers-ui: link:/home/noirbright/Workstation/dsh-llm-providers-ui

No plugin links/settings were changed and no service was restarted. No production files or Core files were edited. The original Model Switch dirty bundle and untracked declaration were not included in the new worktree/commit.

The supplied rc.1 installation is a package.json + node_modules distribution, not a Git checkout (`git describe` fails with not-a-repository). API findings below were verified from its released 0.1.2-rc.1 package declarations and bundles; no clean-tag source-build validation is claimed.

## DeepSeek public interface checkpoint

Paths below are relative to `/home/noirbright/.local/opt/dsh-staging/dsh-v0.1.2-rc.1-a66e470204/node_modules/@deepseek-ai/`.

- `dsh-web/lib/types/index.d.ts:49-52,61-89`: registries and global selection ids are private. Public operations registerSearchProvider/registerFetchProvider/search/fetch provide no provider-specific dispatch or registered-instance lookup.
- `dsh-web/lib/index.js:97-101`: search always resolves the global configured provider. Calling it inside the model-switch adapter would route back to model-switch, not specifically DeepSeek.
- `dsh-web-search-deepseek/lib/types/index.d.ts:9-10`: DeepSeekSearchProvider and options ARE public exports. Do not claim the HTTP implementation is inaccessible.
- `dsh-web-search-deepseek/lib/index.js:270-291`: resolveOptions is private. It binds current settings, literal-key precedence, credential service/environment resolution, endpoint defaults and secret-free request logging.
- Same file `:293-304`: apply creates the configured instance and registers it without exposing that instance/service or a reusable configured factory.
- `dsh-web-search-deepseek/lib/types/provider.d.ts:68-89`: constructing the public class requires caller-supplied resolved options/credential callback. It reuses HTTP logic but does not itself reuse the mounted provider configuration/authentication binding.

Under the task requirement not to duplicate authentication/settings binding, the missing public seam is a provider-owned configured runner/factory with supported model metadata and per-call model selection (or an equivalent public registered-provider dispatch capability). This is narrower than saying no DeepSeek implementation can be reused. No fallback API is requested or needed. No private map access, monkey-patching, scoped service interception, global route mutation or copied resolveOptions is an acceptable substitute.

Until scope is clarified or a suitable released interface exists, do not advertise DeepSeek as an executable Model Switch search option. Codex/Grok and dynamic metadata can be developed independently if a partial delivery is authorized.

## Current behavior and remaining checks

- Runtime search metadata is hardcoded to codex; registration does not update it. The registry has register/get/list but no subscription.
- The carried bundle patch pins official Web search to model-switch. When Model Switch lacks a complete supported route, available() is false and the official selector fails WEB_PROVIDER_CONFIGURED_UNAVAILABLE; it does not silently continue using DeepSeek. Installing the patch therefore changes previous default search behavior.
- Existing direct adapter errors distinguish missing/unsupported routes, but official selection can reject availability before reaching those detailed errors. Test through the official selector.
- Confirmed additional defect: `dsh-app-boot/lib/index.js:59-108`, especially `:102-105`, replaces each top-level entry field; patch.config replaces the entire original config, not a deep merge. The carried search-only patch therefore drops the existing fetchProvider pin. Its existing test asserts patch shape only and misses this. A single available fetch provider may mask the change through auto-selection; another provider can make fetch ambiguous. Do not fix this by hardcoding http, which would still overwrite a custom existing pin. A safe plugin-only configuration approach needs to preserve the effective existing fetch value.
- Three-provider live searches, route/model changes on the next search, dynamic lifecycle/UI metadata, credential failures and unchanged live web_fetch are all NOT VERIFIED.

## Executed baseline tests

From the new worktree (temporary node_modules symlink to ms11 dependencies; not committed):

```sh
pnpm exec vitest run tests/search-provider.spec.ts tests/search-patch.spec.ts
# 2 files, 4 tests passed
pnpm exec vitest run tests/host-runtime.integration.spec.ts
# 1 file, 1 test passed
```

The integration test enters real WebRuntime.search and then a stub adapter. These are baseline tests using existing dependency resolution, not rc.1 three-provider live acceptance and not new feature coverage.
