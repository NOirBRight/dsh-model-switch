# Search integration: three-round review and repair

## Fixed review ranges

- Model Switch: `git diff f1895ce...HEAD` in `dsh-model-switch-picker-tests`; review started at `19908fd`, final reviewed implementation `98021a8`. Commits are listed with `git log f1895ce..HEAD --oneline`.
- Codex: `git diff 250ffa6...HEAD` / `git log 250ffa6..HEAD --oneline`, HEAD `90deb8c` (unchanged during review).
- Grok: `git diff 286e2df...HEAD` / `git log 286e2df..HEAD --oneline`, HEAD `0ce4085` (unchanged during review).

The user explicitly selected these full ranges. Each round used two independent read-only reviewers and re-read the full ranges, not just the latest fix. Standards sources: Workstation AGENTS.md, each repository AGENTS.md, Codex CONTRIBUTING.md, relevant Model Switch PRODUCT.md/IMPLEMENTATION_PLAN.md, and the code-review smell baseline (heuristics, not hard rules). Direct search requirements override the historical Codex-only product limitation. Spec source: the user’s complete search-integration requirements and approved picker-test correction. No issue-tracker configuration was present; the user was informed about /setup-matt-pocock-skills.

## Standards

- Round 1: zero hard violations and zero actionable smells. Public plugin boundaries, Core read-only, deferred ProviderDirectory integration and preserved fetch configuration were confirmed.
- Round 2: zero hard violations; one judgement-call finding: replacing every metadata heartbeat triggered unnecessary React commits. A Profiler regression reproduced this.
- Fix `98021a8`: compare the complete plain metadata signature within the existing polling effect, not the numeric revision alone. Identical healthy heartbeats call no state setters; changed metadata and post-failure recovery still update the UI. No new service, registry or abstraction was introduced.
- Round 3: zero hard violations and zero remaining actionable smells. Reviewer confirmed the full ranges, the content comparison, stable decoder key ordering, and retained lifecycle/safety behavior.

## Spec

- Round 1, after validation: two confirmed defects. After three RPC failures, polling stopped forever until remount. Also a restarted Host could reuse revision zero and have its new catalog discarded by revision-only deduplication.
- Fix `82fa7a4`: retain fail-closed UI but retry with capped exponential delay (maximum 20 seconds); failed retries request a fresh snapshot; initial-load errors are visible; new content is accepted despite revision reuse. Regressions covered recovery both before and after an initial successful load, plus a reused revision. All reproduced red before the fix.
- Three initial concerns were withdrawn/qualified after tracing the actual contracts: available=true denotes a supported runtime seam, with empty catalogs preserving invalid-selection warnings; scope.get inside ctx.inject is rerun with the injected dependency lifecycle; provider-owned model predicates match executable search gates (no concrete incorrectly advertised model was found). These were not waived as actual defects.
- Round 2: zero remaining actionable findings.
- Round 3: zero remaining actionable findings after the content-deduplication follow-up. Reviewer confirmed that failures>0 clears an error even if recovered metadata content is identical, revision reuse still accepts new content, and polling/abort/timer cleanup remain intact.

## Verification

```sh
# Model Switch, isolated worktree
pnpm test
# 38 files, 169 passed, no exclusions or skips
pnpm run build
DSH_RELEASE_ANCHOR=/home/noirbright/.local/opt/dsh-staging/dsh-v0.1.2-rc.1-a66e470204/package.json pnpm exec vitest run --config tests/vitest.release.config.ts
# 6 files, 14 passed
git diff --exit-code -- src lib
git diff --check

# Respective unchanged provider worktrees
pnpm test
# Codex: 142 passed, one existing skipped test
# Grok: 143 passed
```

Only the existing lab service was restarted. Actual DSH_HOME was rechecked as `/home/noirbright/.dsh-rc1-canary`. Its Model Switch link changed from `.worktrees/dsh-model-switch-search` to `.worktrees/dsh-model-switch-picker-tests`; other plugin link targets were left as found. The reviewed client was rebuilt before deployment.

A fresh isolated Chrome profile opened only `http://127.0.0.1:3082`. Browser-local fault injection failed exactly the first three `/model-switch/capabilities` network requests, then allowed real Host responses. Without refreshing/remounting, Web search recovered and displayed DeepSeek, Codex and Grok with their matching model lists. Draft selections were exercised without Save. The browser and private cookie profile were removed afterward; no server test endpoint or replacement tool was installed. Revision reuse and identical-heartbeat behavior were checked deterministically in component tests; no real Host restart during a held browser session is claimed for that case.

Provider search execution was unchanged in this review cycle; prior three-provider real-search and fetch evidence remains in [the integration audit](search-provider-audit.md). Production/3080 and Core were not changed; no push, tag, release or production promotion occurred. Formal release still needs coordinated immutable artifacts and their lab installation gate.

Final summary: Standards 0 unresolved (0 hard violations); Spec 0 unresolved. This is zero known actionable findings within the reviewed ranges, not a guarantee of no unknown defects.
