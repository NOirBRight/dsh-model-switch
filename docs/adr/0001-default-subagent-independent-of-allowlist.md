# Default Subagent route is not an Allowlist

DSH 0.1.6 already lets an agent pick a child model from an official Allowlist. Model Switch will not copy, filter, or re-own that list. It keeps one optional Default Subagent route for the case the agent names nothing, and that route is allowed to sit outside the Allowlist so a cheap default can coexist with an Allowlist that still permits a dearer explicit choice.
