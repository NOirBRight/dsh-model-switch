# Search provider integration: audit and live acceptance

Status: all three search providers now have successful 3082 live evidence. The user authorized copying only the production DeepSeek credential to lab; both DeepSeek models passed the follow-up. This closes the missing-credential acceptance gap, not the separate release-readiness gaps below.

## Current result (supersedes the initial interface interpretation below)

The user clarified that reusing configured credentials through public services is allowed. The initial interpretation was too strict: no Core change is needed. The bridge uses the official exported DeepSeekSearchProvider and Config schema; only the provider-scoped settings/credential binding and per-call model override live in the plugin. Invalid settings and credential references fail without echoing their values. HTTP/search/authentication request implementation is not copied.

Implemented: registry-owned metadata projection and lifecycle subscriptions; bounded authenticated Host capability RPC; UI consumes only Host search models (no conversational/native-network fallback), validates metadata, keeps invalid selections visible, disables stale/unsupported saves and cleans up subscriptions. Codex/Grok self-declare metadata and execute provider-owned searches. No third registry or replacement web tool. In-place model-catalog changes update the wire revision at the next 20-second heartbeat.

### Actual 3082 evidence

A temporary, authenticated lab-only RPC harness invoked **the official ctx.web.search selector**, which selected model-switch and then the actual provider adapter. It did not directly invoke an adapter, register a replacement tool, or modify Core. Provider/model changes used the public Settings RPC at the current revision. Search requests asked for the official deepseek-ai/deepseek-harness repository.

| Check | Result | Evidence |
| --- | --- | --- |
| No search configuration | Explicit failure, no fallback | WEB_PROVIDER_CONFIGURED_UNAVAILABLE |
| DeepSeek / deepseek-v4-flash | Success after authorized credential copy | 3,495 ms; five source URLs including the official repository README |
| DeepSeek / deepseek-v4-pro, next request | Success after model switch | 4,445 ms; five source URLs including the official repository README |
| Codex / gpt-5.6-luna | Success | 2,916 ms; five returned source URLs including https://github.com/deepseek-ai/deepseek-harness/ |
| Grok / grok-4.6 | Success | 17,840 ms; source https://github.com/deepseek-ai/deepseek-harness |
| Grok / grok-4.5, next request | Success after model switch | 10,127 ms; four sources including the repository README |
| web_fetch on example.com, before/after | Same official safety rejection | WEB_BLOCKED_URL; no safety bypass or provider replacement |
| web_fetch on https://1.1.1.1/cdn-cgi/trace, before/after search-route change | Success both times | HTTP 200, text body, truncated=false |

Live browser verification used installed headless Chrome with an isolated profile and authenticated **only http://127.0.0.1:3082**. After page refresh, Settings > Model Switch > Web search displayed the three Host-registered providers and their matching model lists. Provider changes were exercised as unsaved drafts; no unrelated settings were saved. The temporary acceptance plugin was removed afterward.

Final lab composition keeps the four test worktree links (listed below), an explicit Web searchProvider=model-switch, and the original effective fetchProvider=http. Original search provider/model settings were restored to unset, so searching requires an explicit supported selection. This is the documented no-configuration behavior, not an automatic Codex or DeepSeek default. No production home/3080/Core changes, no push, no release.

Lab lockfile comparison: only the four intended dependency link entries changed; package and snapshot maps were identical. Original package/patch/lock backups and detailed live results remain private under the Model Switch worktree .scratch (not committed or packed). Development note: a Codex worker accidentally made a credential-backed non-lab probe before isolating its test; that probe is excluded from acceptance, was not repeated, and no credentials were printed. All live evidence in the table is from 3082.

### DeepSeek follow-up, fetch boundary and release readiness

The prior WEB_PROVIDER_CREDENTIAL_MISSING result was real and is superseded by the successful follow-up above. Only DEEPSEEK_API_KEY was read from production and copied through the released public LocalCredentialProvider.set API to the actual lab home (/home/noirbright/.dsh-rc1-canary). The source credential file was verified byte-for-byte unchanged; all other lab credential references and records were verified unchanged. Secret values were never printed, put into helper source, or committed. The copied key remains in the lab credential store as authorized.

The existing guarded lab RPC probe again called the official ctx.web.search selector. Both model searches succeeded, original Model Switch search selections were restored, and the temporary probe was removed. Production was not modified or restarted. Detailed results are in the private .scratch/deepseek-followup-results.json; no helper or secret store is a release artifact.

**Fetch is not DeepSeek-dependent.** The deployed fetch provider remains official http. Neither provider repository currently registers a FetchProvider; Codex/Grok native networking/search tools are not an implementation of the official standalone web_fetch contract. No new fetch adapter is needed for the currently tested URL-fetch behavior. Adding provider-backed fetch routing would be a separate feature, not part of search unification.

**Release assessment:** the search feature is functionally ready for candidate-release preparation. Do not treat this as approval to publish/promote the whole package unchanged: the full suite still has eight reproduced baseline picker failures, which need repair or an explicit release waiver with evidence; package versions (Model Switch 0.4.5, Codex 0.3.13, Grok 0.3.10) have not been advanced for this work; the coordinated dependency/baseline composition must be carried into new immutable release artifacts and verified on 3082 from those artifacts rather than link worktrees. No tag, push, release, or production installation was performed.

### Commands and results

Model Switch worktree:

```sh
pnpm run build
DSH_RELEASE_ANCHOR=/home/noirbright/.local/opt/dsh-staging/dsh-v0.1.2-rc.1-a66e470204/package.json pnpm exec vitest run --config tests/vitest.release.config.ts
# 6 files, 14 tests passed against released public rc.1 packages
pnpm exec vitest run --exclude tests/picker/registration.spec.ts --exclude tests/picker/plan-review-card.spec.tsx
# 36 files, 151 tests passed
pnpm pack --pack-destination .scratch
# Local tarball only; no source, tests, private .scratch files or acceptance harness included
```

Final `pnpm exec vitest run`: 157 passed, eight failed (38 files; 2.38 seconds), with no worker/heap error. The eight **pre-existing** picker failures are: three registration tests and five Plan Review tests. They reproduce unchanged in a fresh detached f1895ce worktree with the same dependency resolution (`pnpm exec vitest run tests/picker/registration.spec.ts tests/picker/plan-review-card.spec.tsx`: eight failed, six passed). They were not hidden or fixed by changing unrelated picker behavior. An initial new UI test OOM was fixed at its render-unstable test snapshot root cause; final tests use the normal heap and finish normally.

Codex: pnpm test => 142 passed / one skipped; pnpm run build passed. Grok: pnpm test => 143 passed; pnpm run build passed. Provider tests mock networking; they are not counted as live evidence.

### Isolated branches and commits

- Model Switch: agent/search-provider-unification in .worktrees/dsh-model-switch-search; preserves f1895ce plus reviewed 1bb555f as bb6ae4a. Search implementation is 4226566 (subsequent to initial audit 22e52f1); this report is committed separately.
- Codex: agent/codex-search in .worktrees/dsh-llm-codex-search; 4ae92e8 reconciles the UI10 dependency onto 250ffa6; 38cffde implements search metadata/tests; 90deb8c documents integration.
- Grok: agent/grok-search in .worktrees/dsh-llm-grok-search; 0a0e7ed implements search on 286e2df; da3ae5a hardens error/evidence handling; 0ce4085 documents integration.
- ProviderDirectory: agent/providers-search-dependency in .worktrees/dsh-llm-providers-search, unchanged c79de2f. No new code commit needed.

## Historical pre-implementation checkpoint

The remainder records the initial read-only audit and baseline tests; statements about stopping before deployment describe that checkpoint, not the current result above.

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
