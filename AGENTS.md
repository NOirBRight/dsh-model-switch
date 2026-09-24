# Model Switch agent policy

This repository inherits `../AGENTS.md`; read it before changing this checkout.

- Keep every implementation, compatibility adapter, test, and build rule in this plugin. Treat DSH Core and every official DSH checkout/tag as read-only.
- Validate only against a clean official DSH tag and, in runtime milestones, the lab plane (`DSH_HOME=~/.dsh-lab`, port 3082). Milestone 1 is pure-module/package validation and does not deploy.
- Use only released public DSH/Cordis interfaces. When a required public seam is absent, keep that runtime capability disabled and fail with an explicit error; record the seam for a later upstream proposal.
- The frozen scope is authoritative in `PRODUCT.md`; use `IMPLEMENTATION_PLAN.md` for milestone sequencing. `SPEC.md` is historical and superseded.
- Preserve the product/package/bundle/page identity: **Model Switch** / `dsh-model-switch`.

## DSH 版本兼容

- 官方 DSH Host 包（`@deepseek-ai/dsh` 及其工作区 `@deepseek-ai/dsh-*` 包）在 `package.json` 的 `dependencies`、`optionalDependencies`、`devDependencies`、`peerDependencies` 中使用无上界的下限范围 `>=<最早已验证兼容版本>`；锁文件可固定实际验证的版本。独立发布的插件依赖按其发布渠道声明。
- 声明兼容新 DSH release 前，审查其公开 API 变化与插件实际调用，运行相关测试和 `pnpm run build`，并在 3082（`DSH_HOME=~/.dsh-lab`）验证；全部通过后再宣称兼容。
