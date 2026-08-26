# Model Switch agent policy

This repository inherits `../AGENTS.md`; read it before changing this checkout.

- Keep every implementation, compatibility adapter, test, and build rule in this plugin. Treat DSH Core and every official DSH checkout/tag as read-only.
- Validate only against a clean official DSH tag and, in runtime milestones, the lab plane (`DSH_HOME=~/.dsh-lab`, port 3082). Milestone 1 is pure-module/package validation and does not deploy.
- Use only released public DSH/Cordis interfaces. When a required public seam is absent, keep that runtime capability disabled and fail with an explicit error; record the seam for a later upstream proposal.
- The frozen scope is authoritative in `PRODUCT.md`; use `IMPLEMENTATION_PLAN.md` for milestone sequencing. `SPEC.md` is historical and superseded.
- Preserve the product/package/bundle/page identity: **Model Switch** / `dsh-model-switch`.
