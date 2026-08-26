# Model Switch

Model Switch (`dsh-model-switch`) is a plugin-only foundation for validated model routing across new Main sessions and local subagents.

The package now ships its pure routing modules, a Cordis Host service, and a localized Client Settings section. Main defaults save atomically through the released Settings RPC and affect new sessions only. The public bundle patch disables the official `subagent` row by its released id and inserts the uniquely named `dsh-model-switch/subagent-runtime` replacement. The replacement subclasses the released rc.2 `SubagentRuntime` and changes only each request's provider/model before delegating to the official one-shot or continuable implementation. Explicit provider+model request options win, fixed policy is next, and follow-main uses the parent's current request header/options before the Main default. Follow-main preserves the active parent's provider/model even when rc.2 cannot carry its effort, in which case the child uses the provider default. Partial routes, ambiguous/unexpected Loader rows, and explicitly configured Subagent effort fail explicitly because rc.2 cannot persist effort through the released one-shot/cold-resume descriptor contract. Capabilities whose rc.2 public seams are absent—model-selectable provider adapters and legacy tool-owner suppression—are not exposed by this release. Ordinary chat attachments are outside this version's Model Switch routes and remain on the official path. Official AgentPresets remains mounted so it shares the process `dsh-scope` identity; Model Switch ships no preset copies.

## Public module foundation

- capability-aware `ModelSelection` validation and default effort resolution
- versioned Main settings copied only for new sessions
- follow-main/fixed subagent route snapshots with workflow override and cold restore
- official/provider Search, image reading, chat attachments, and image generation left unchanged

See [PRODUCT.md](PRODUCT.md) for frozen scope and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for staged integration and exact rc.2 seam constraints. [SPEC.md](SPEC.md) is retained only as superseded history.

## Installation

```sh
DSH_HOME=~/.dsh dsh plugin --profile web add github:NOirBRight/dsh-model-switch#v0.1.0
```

Restart the selected DSH profile after installation. Production profiles should use the released GitHub tag rather than a local workspace dependency.

## Development

Requires Node 22.19+ and pnpm.

```sh
pnpm install
pnpm run check
```

`check` builds declarations plus Host and Client bundles, runs unit and real Cordis/Settings composition tests, validates every export from an extracted tarball, and rebuilds under different filesystem roots to prove reproducibility.
