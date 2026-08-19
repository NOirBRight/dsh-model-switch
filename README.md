# dsh-model-switch

Spec and tracking repo for **Model purposes** in DeepSeek Harness: how the product chooses models for in-process child agents, session titles, compaction, web search/fetch, and an optional compact-before-downswitch.

Implementation lands in `deepseek-harness`. This repository holds the locked spec from the design session.

See [SPEC.md](SPEC.md).

## Tickets

Private repo: [NOirBRight/dsh-model-switch](https://github.com/NOirBRight/dsh-model-switch). Implementation lands in `deepseek-harness`. Frontier is **#1**.

| # | Title | Blocked by |
|---|---|---|
| [1](https://github.com/NOirBRight/dsh-model-switch/issues/1) | Inherit uses the live picker for in-process children | — |
| [2](https://github.com/NOirBRight/dsh-model-switch/issues/2) | Model purposes page and child pin | #1 |
| [3](https://github.com/NOirBRight/dsh-model-switch/issues/3) | Child tiers, tool `tier` param, and workflow without raw ids | #2 |
| [4](https://github.com/NOirBRight/dsh-model-switch/issues/4) | Title follow or pin | #1, #2 |
| [5](https://github.com/NOirBRight/dsh-model-switch/issues/5) | Compaction summarizer follow or pin | #1, #2 |
| [6](https://github.com/NOirBRight/dsh-model-switch/issues/6) | Optional compact on downswitch | #5 |
| [7](https://github.com/NOirBRight/dsh-model-switch/issues/7) | Search and fetch provider home | #2 |
