# Changelog

## 0.3.6 - 2026-08-27

- Restore non-strict lookup for the optional mobile interaction service; Cordis may reject direct undeclared-property access, which previously crashed the custom seat on render.

## 0.3.5 - 2026-08-27

- Declare the merged picker's Sessions and model-directory services in the client plugin's top-level injection contract so production completes the custom seat registration.

## 0.3.4 - 2026-08-27

- Contain composer-seat render/effect errors inside the merged picker so a crash cannot silently abdicate to the official picker; show a retryable diagnostic instead.
- Treat the Sessions face as optional while the public model-directory service gate is active.

## 0.3.3 - 2026-08-27

- Restore merged picker ownership of the composer model seat by matching the official service gate and using an unambiguous winning priority.
- Treat optional mobile interaction-surface failures as a graceful degradation instead of crashing and abdicating the custom seat to the official picker.

## 0.3.2 - 2026-08-27

- Match Model Switch route cards to the shared LLM Providers chrome: radius, fill, border, spacing, icon treatment, title weight, summary size, chevron, and expanded body.

## 0.3.1 - 2026-08-27

- Keep the Model Switch settings nav glyph after the official Settings shell redraws its SVG.
- Restore a visible platform-gray fill for collapsed route cards; every route remains collapsed on mount.

## 0.3.0 - 2026-08-27

- Absorb the composer model picker and Plan Review execution picker into this package.
- Plan Review uses the official warn-strip card, a short capsule trigger, and a two-level Model/Effort/Context/Fast/Thinking menu.
- One `dsh plugin add dsh-model-switch` now covers routing Settings and composer/Plan selection. Remove a standalone `dsh-composer-picker` install to avoid a second model seat.
- Picker trigger shows the family name plus distinct effort / Fast / context bits; duplicate context windows collapse to one menu row.
- Known limitations: Settings nav icon still patches official nav DOM (no public icon field, same pattern as usage-monitor). The `external-agents.plan-review.continue-in-dsh` adapter stays registered for dual-install; Plan Review takeover currently wins at priority -7 because the official Plan handoff seam is unavailable.

## 0.2.0 - 2026-08-26

- Keep official `web_search` ownership and add a thin `model-switch` Web Search provider with Codex model routing.
- Add stable `generate_image` routing through optional Codex and Grok adapters, with provider-specific schemas regenerated after Image route changes.
- Add Search and Image settings cards while keeping Vision/read_image excluded.
- Preserve existing provider-specific image tools and `web_fetch` as rollback paths.


## 0.1.1 - 2026-08-26

- Ship compiled Host/Client `lib/` in the git tag so `github:…#v0.1.1` installs can boot.

## 0.1.0 - 2026-08-26

- Add Main default and follow-main/fixed Subagent model routing for DSH 0.1.1-rc.2.
- Resolve follow-main from the active parent request header before stale session options.
- Preserve inherited provider/model when rc.2 cannot carry reasoning effort.
- Leave Search, Vision, image reading, ordinary chat attachments, and image generation on their existing official/provider paths.
- Add localized Model Switch settings and clean plugin lifecycle integration.
- Keep ordinary chat attachments on the official DSH path.
