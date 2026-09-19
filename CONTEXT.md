# Model Switch

A plugin-owned routing context: which model a request uses, and who is allowed to choose it. It is not DSH Core, and it is not provider credentials.

## Language

**Main default**:
The provider, model, and optional effort copied into newly created sessions. Existing sessions are never migrated through this default.
_Avoid_: global model, picker selection

**Default Subagent route**:
An optional single provider/model/effort used when a child spawn does not name a route. A human setting. It is not an Allowlist, and it is not required to be a member of the Allowlist. When it is absent, Official inherit applies.
_Avoid_: Subagent allowlist, follow-main, Subagent switch

**Allowlist**:
The official, session-sampled set of exact provider/model routes an agent may name when spawning a child. Owned by DSH plugin settings (`subagent-model-selection`), not by Model Switch.
_Avoid_: Default Subagent route, authorized models (as a Model Switch setting)

**Official inherit**:
DSH's fallback when a child spawn names no route: the parent session's latest request, then its creation snapshot. Model Switch does not replace this.
_Avoid_: follow-main, follow Main, Default Subagent route

**Explicit child route**:
A complete provider and model supplied on the spawn itself by the agent, a workflow, or a tool argument. It wins over the Default Subagent route. Any named provider, model, or effort on the spawn also skips Default Subagent injection; Official inherit fills incomplete spawns.
_Avoid_: override, lock

**Switch compaction**:
A send-time protection: when a sent message uses a different model than the last request, check the target window and, if needed, compact once with the previous model. Choosing a model in the picker does not compact.
_Avoid_: compaction model, summarization route, /compact, global compaction

## ADRs

- [0001](docs/adr/0001-default-subagent-independent-of-allowlist.md): Default Subagent route is independent of the Allowlist.
- [0002](docs/adr/0002-drop-follow-main-for-official-inherit.md): unset Default Subagent route means Official inherit.
- [0003](docs/adr/0003-switch-compaction-send-protection-row.md): Switch compaction is not a summarization route; chrome is a Send protection B-row.
