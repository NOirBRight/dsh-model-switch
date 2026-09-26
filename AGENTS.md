# Model Switch agent policy

This repository inherits `../AGENTS.md`; read it before changing this checkout.

- Keep every implementation, compatibility adapter, test, and build rule in this plugin. Treat DSH Core and every official DSH checkout/tag as read-only.
- Validate only against a clean official DSH tag and, in runtime milestones, the lab plane (`DSH_HOME=~/.dsh-lab`, port 3082). Milestone 1 is pure-module/package validation and does not deploy.
- Use only released public DSH/Cordis interfaces. When a required public seam is absent, keep that runtime capability disabled and fail with an explicit error; record the seam for a later upstream proposal.
- The frozen scope is authoritative in `PRODUCT.md`; use `IMPLEMENTATION_PLAN.md` for milestone sequencing. `SPEC.md` is historical and superseded.
- Preserve the product/package/bundle/page identity: **Model Switch** / `dsh-model-switch`.

## DSH 版本兼容

- 官方 DSH Host 包（`@deepseek-ai/dsh` 及 `@deepseek-ai/dsh-*`）在 `package.json` 的 `dependencies`、`optionalDependencies`、`devDependencies`、`peerDependencies` 中使用无上界的下限范围 `>=最低已验证兼容版本`；不得用精确版本或带上界的范围限制后续版本。锁文件、构建输入和安装/发布工件选择器可固定实际验证的版本。
- 对有明确公开 API 或协议兼容承诺的 DSH 插件 peer，也使用无上界的下限范围 `>=最低已验证兼容版本`。未定义兼容承诺的插件协议应先定义并验证；不要仅凭包名放宽版本。插件 peer 新版本通过互操作测试和构建后，再声明兼容。
- 声明兼容新 DSH release 前，审查其公开 API 变化与插件实际调用，运行相关测试和 `pnpm run build`，并在 3082（`DSH_HOME=~/.dsh-lab`）验证；全部通过后再宣称兼容。
