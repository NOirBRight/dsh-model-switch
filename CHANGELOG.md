# Changelog

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
