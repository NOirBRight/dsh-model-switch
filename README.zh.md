# Model Switch

[English](README.md) | 中文

在 DeepSeek Harness 中为 Main、Subagent、Web Search、图像生成、当前会话和 Plan 执行模型配置明确路由。Model Switch 只使用 DSH 公开服务和 Provider 自有 Adapter；不修改 DSH Core，也不管理 Provider 登录凭证。

<p align="center"><img src="docs/screenshots/composer-picker.png" alt="包含 Model、Effort、Context 和 Fast 的 Composer Picker" width="314"></p>

Picker 在切换页面或关闭搜索时保留键盘焦点，不覆盖搜索框的自动聚焦。从摘要页按 Escape 会关闭 Picker，并将焦点还给触发按钮。

## 路由

| 路由 | 行为 |
| --- | --- |
| Main 模型 | 新建会话的默认 provider、model 和可选 effort；不迁移已有会话。 |
| Subagent | 跟随当前父请求，或使用固定 provider/model/effort；Workflow 显式覆盖始终优先。 |
| Composer Picker | 只修改当前会话，并提交 catalog 中的原始 model id；Main 默认值保持不变。 |
| Plan Review | 在发送 Plan 审核确认前，先提交执行模型。 |
| Web Search | 保留官方 `web_search`；部署显式启用后，通过 Provider 动态声明的独立搜索适配器路由。 |
| 图像生成 | 提供一个稳定的 `generate_image` 工具，通过选定的 Codex 或 Grok Adapter 路由。 |

无效、不可用或不受支持的路由会明确失败。Model Switch 不会静默换到另一个 provider 或模型。

空闲的空白会话可以选择 External Agent。提交中、等待首个 turn 以及运行期间，从请求开始就锁定所选执行运行时，不等待首 token 或原生绑定：Antigravity 保留其模型和 effort 选择；DSH 保留 LLM provider 选择，但禁用 Agent provider。会话一旦有过用户消息，Composer 和 Plan Review 仍显示 Agent 角色行但将其禁用，除非该会话已经绑定原生运行时。当前会话成功打开 Antigravity 原生会话后，Picker 会在该会话内禁用其他 provider，同时保留 Antigravity 模型与 effort 控件。DSH 全局 Picker 锁仍拥有最高优先级。

## 配置 Main 和 Subagent

打开 **设置 → Model Switch**。Main 修改只影响新建会话。Subagent 可以跟随 Main，也可以使用固定 provider、model 和 effort。
官方 DSH `0.1.7-alpha.2` 在非本机浏览器将 ConfigForms 设为仅内存模式，页面会明确显示不可用；请在 Host 的 127.0.0.1 页面打开设置。此模式下 Picker 也拒绝模型切换：已发布的 `session.selectModel` 会同时写入全局默认模型，但只读 Main 表单无法安全恢复。远端编辑与真正仅会话的切换需要上游提供受鉴权的 ConfigForm 通道及仅会话的选择接口；本插件不会绕过官方策略。

切换 Main 或固定 Subagent 的 provider/model 时，会用目标模型的默认 effort 替换旧模型的 effort；目标模型不支持推理时不传 effort。

![Model Switch 设置中的固定 Subagent 路由](docs/screenshots/settings-subagent.png)

Follow Main 先读取当前父请求，再读取配置的 Main 默认值。固定路由会在官方 Subagent descriptor 创建前注入。DSH 0.1.2-alpha.4 会在该 descriptor 中携带 provider、model 和固定 reasoning effort。

## 自定义模型如何出现在 Picker

Model Switch 不会把自身设置中任意填写的字符串变成模型。Provider 插件必须先把模型发布到 DSH 官方 Model Catalog：

```text
Provider 配置
→ Provider 将模型行发布到 DSH Catalog
→ 当前会话 Model Directory 提供 provider/model 元数据
→ Model Switch 对 Catalog 行分组
→ Picker 提交原始 provider id 和 model id
```

Catalog 提供 provider 名称、model id/name、reasoning efforts 和 default effort。已经保存但不再出现在 Catalog 中的路由，会在 Settings 中显示为 unavailable；Picker 不会假装它仍可路由。

### 变体 id 规则

Model Switch 按 provider，以及剥离以下后缀后的 model id 对 Catalog 行分组：

| Catalog model id | Picker 变体 |
| --- | --- |
| `acme-v1` | 标准模型 |
| `acme-v1-fast` | Fast |
| `acme-v1-128k` | Context 128K |
| `acme-v1-1m` | Context 1M |
| `acme-v1-1m-fast` | Context 1M + Fast |

规则：

- `-fast` 生成 Fast 轴。
- `-<n>k` 和 `-<n>m` 生成 Context 档位；可以与 `-fast` 按任意顺序组合。
- `reasoning.efforts` 生成 Effort 选项；`reasoning.defaultEffort` 是初始值。
- 切换 Fast、Context 或 Thinking 变体时，只有目标 Catalog 行支持当前 effort 才会保留；否则改用目标行的默认 effort，目标没有默认值时不传 effort。
- Catalog 中存在 reasoning 元数据时，该模型行具备 Thinking 能力。
- 无法识别的 id 不会被丢弃，而是作为独立 model family 显示。

组合选择必须由 Provider 发布组合行。只有 `acme-v1-fast` 和 `acme-v1-1m` 不能表示 Fast + 1M；还必须发布 `acme-v1-1m-fast`。Picker 永远不会合成 Provider 没有发布的 model id。

## Plan Review

Plan Review 拥有独立于 Main 的执行模型草稿。**确认执行**会先把该模型提交到当前会话，再回答待处理的 Plan 审核。模型提交失败时，审核保持待处理并允许重试。**拒绝**和**去聊天里说**不会执行 Plan。

![带执行模型 Picker 的 Plan Review](docs/screenshots/plan-review.png)

## 发送时的上下文保护

当发送后的实际请求将使用与上次不同的模型或窗口档位时，Model Switch 会在目标请求发出前检查完整待发上下文。仅在选择器中选模型不会压缩。超出目标可用容量时，使用切换前的模型、通过私有压缩引擎压缩一次历史；不会改 DSH 自身的自动压缩设置。进度以插件通知出现在正文中。预算包含完成提示和待提交的模型切换提示；摘要仍超限时会阻止请求。失败时用户消息留在会话里，不会发送目标模型请求，也不会出现切换成功提示。可在 **设置 → 模型切换 → 发送时自动检查并压缩上下文** 关闭（默认开启）。原生 External Agent 运行时的内部上下文不会被当成 DSH 可压缩历史。

## Model Switch 不会改变什么

- `web_fetch` 及其配置的 provider
- Vision 路由、`read_image` 和普通聊天附件
- Provider 登录、凭证或 Provider 设置卡
- 官方 Agent Presets
- 已有的 Provider 专属图像工具
- Main 默认值修改前已经存在的会话
- 全局压缩策略、标题或 DSH Core

## 安装

安装 Model Switch，以及实际使用的 Provider Adapter。此版本已在官方 DeepSeek Harness `0.1.7-rc.2` 上检查：

```sh
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-providers-ui/releases/latest/download/dsh-llm-providers-ui-0.2.12.tgz
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-codex/releases/latest/download/dsh-llm-codex-0.3.23.tgz
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-grok/releases/latest/download/dsh-llm-grok-0.3.19.tgz
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-model-switch/releases/latest/download/dsh-model-switch-0.4.16.tgz
```

### 搜索供应商统一接入（0.4.7）

搜索列表来自 Host 上已有的 `ModelSwitchAdapterRegistry`，Provider 自声明名称和独立搜索模型；浏览器只收到普通元数据，不收到凭据或可执行函数。注册、卸载会通知订阅者；原地修改模型声明最迟由 20 秒心跳更新。`ProviderDirectory` 继续负责客户端 role/usage，不另造注册表。 已发布 0.2.8 的 `sortCatalogGroups` 只排序硬编码 LLM 路由；Model Switch 自行按实时 `catalogRoutes` 排序，因此 Owner 公布 Agent catalog id 时会跟随已保存的卡片顺序。原生 `catalogId` / `unknown` 账户样式仍需要比已发布 0.2.8 更新的 Owner。模型原生联网不等于独立 `web_search` 适配器。

DeepSeek 薄适配器调用官方公开 `DeepSeekSearchProvider`，复用用户的 `web-search-deepseek` 设置和公开凭据服务；Codex 复用 ChatGPT 登录，Grok 复用已有订阅凭据。缺凭据、配置错误、模型不支持均明确失败，不静默切换。

**注册不等于选中全局路由。** 安装插件不再覆盖 Web 配置。部署时先用 `dsh --profile web --dump-config` 查看完整 Web 配置，只把 `searchProvider` 改为 `model-switch`，其余字段原样保留。注意 id 定位的 patch 会整体替换 `config`，不会深度合并；不能只写 searchProvider，也不能把自定义 fetchProvider 写死成 http。

然后在 Model Switch 设置中选择请求的供应商/模型。全局已选 Model Switch、但没有完整且受支持的搜索配置时，官方选择层返回 `WEB_PROVIDER_CONFIGURED_UNAVAILABLE`，不会回退 DeepSeek。全局未选 Model Switch 时，下拉框不控制官方搜索；未固定全局供应商且有多个可用 provider 时会明确报歧义。卸载前应恢复部署原来的搜索路由。官方 `web_search`、`web_fetch` 均不替换。

本轮分支、测试命令及 3082 live 证据见 [搜索接入审计](docs/search-provider-audit.md)。经授权复用生产 DeepSeek 凭据后，Flash/Pro 的 3082 真实搜索均通过，三家均已有成功证据。Picker 测试夹具及审查发现的元数据恢复问题已修正，保留 v0.4.6 兼容性后全量 172 个测试通过。生产推广仍须先在 lab 安装验收同一组不可变发布产物。

如果 profile 已安装 `dsh-composer-picker`，请先移除它。Model Switch 已经拥有 Composer Picker 和 Plan Review 席位；同时安装会产生重复或竞争 UI。

生产 profile 必须使用已发布的 GitHub tag，不能使用工作区本地依赖。安装或修改路由后重启对应的 DSH profile。

## 兼容性

DSH Host peer 和开发依赖接受 `>=0.1.7-alpha.2`，包括 rc.1 和后续版本。开发锁文件解析到 rc.2。Cordis 接受 `>=4.0.4 <5.0.0`。

`package.json#dsh.compatibility.dshReleases` 中的已验证版本是证据，不是允许列表。新增验证声明前要审查公开 API 变化并测试新 Host 版本。

## 开发

需要 Node 22.19+ 和 pnpm。

```sh
pnpm install
pnpm run check
```

`check` 会构建 Host/Client artifacts，运行单元测试和 Cordis/Settings 组合测试，检查提取后的发布包，并验证 bundle 可复现。产品范围见 [PRODUCT.md](PRODUCT.md)，实现约束见 [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)。

## 正式版安装（Latest）

本版在官方 DeepSeek Harness `0.1.7-rc.2` 上验证了 Main、子代理、Composer 与能力路由；发布包只包含构建后的 Host/Client 产物，不包含兄弟仓库源码或本机路径。

Latest 安装命令（资产文件名必须与当前 latest Release 一致）：

~~~sh
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-providers-ui/releases/latest/download/dsh-llm-providers-ui-0.2.12.tgz
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-model-switch/releases/latest/download/dsh-model-switch-0.4.16.tgz
~~~

固定版本安装命令：

~~~sh
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-providers-ui/releases/download/v0.2.12/dsh-llm-providers-ui-0.2.12.tgz
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-model-switch/releases/download/v0.4.16/dsh-model-switch-0.4.16.tgz
~~~

更新、卸载与验证：

~~~sh
# 更新到最新 Release
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-providers-ui/releases/latest/download/dsh-llm-providers-ui-0.2.12.tgz
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-model-switch/releases/latest/download/dsh-model-switch-0.4.16.tgz
# 验证加载与版本
dsh plugin --profile web list
dsh plugin --profile web doctor
# 只卸载本插件
dsh plugin --profile web remove dsh-model-switch
~~~

配置入口：Web 使用「设置」中的本插件页面；Host-only 插件使用 profile 的 dsh.profile.bundles 配置。先复制本 README 的最小 YAML/JSON 示例，再填写凭据或后端地址。

回滚：重新安装不可变的 v0.4.15 归档并恢复已记录的 profile；不需要降级 Host。失败时查看 journalctl --user -u dsh-web.service 与 dsh plugin --profile web doctor，不要将源码 checkout 链入生产 profile。

Release 与完整性：[v0.4.16](https://github.com/NOirBRight/dsh-model-switch/releases/tag/v0.4.16) · [SHA256](https://github.com/NOirBRight/dsh-model-switch/releases/download/v0.4.16/dsh-model-switch-0.4.16.tgz.sha256)。
