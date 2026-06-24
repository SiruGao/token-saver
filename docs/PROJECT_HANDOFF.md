# Token Saver 项目交接文档

> 更新时间：2026-06-24  
> 仓库：`SiruGao/token-saver`  
> 当前正式代码版本：`1.0.5`  
> 当前 `main`：`07db0166c7b223dc04876b5830807454e8876709`  
> 当前未合并重点 PR：[#26 Add built-in large tool-result isolation for Claude Code](https://github.com/SiruGao/token-saver/pull/26)

---

## 0. 给新对话的最短接手说明

Token Saver 不是单一压缩算法，也不能退化成“RTK 安装器”。它的目标是成为一个本地优先的 AI Agent Token 优化控制层：自动发现用户已有的 AI 工具，经过一次明确授权后连接本地使用数据，识别浪费来源，选择兼容且低风险的优化策略，自动或半自动完成配置，并用统一、可信的数据证明效果。

当前 `main` 已经具备：

1. 浅色、清晰、数据优先的桌面 UI；
2. Doctor 规则分析、Strategy Hub、Proof Ledger；
3. RTK 一键安装、校验、Claude Code 接入与估算节省展示；
4. Codex 本地历史只读连接器；
5. Claude Code 生命周期与工具事件连接器；
6. 本地 SQLite Proof Ledger、自动更新、签名构建检查。

当前正在开发但尚未合并的是 PR #26：Token Saver 自己实现的 Claude Code 大型 Tool Result Isolation，用于处理 RTK 无法覆盖的 Read、Grep、Glob、Web、MCP 等大型非终端结果。

新对话首先要做的事情：

1. 读取本文件；
2. 查看 `main` 和 PR #26 的最新状态；
3. 不要假定 PR #26 已经实机验证；
4. 不要继续大改 UI，优先完成真实优化、真实连接和真实验证；
5. 不要把 Estimated 数据写成 Verified；
6. 不要把 Detected 写成 Connected；
7. 不要声称 Codex 已经被自动优化，目前 Codex 只完成观察与历史同步。

---

# 1. 项目目标和核心需求

## 1.1 产品目标

Token Saver 的最终目标是：

```text
自动发现 AI 工具
→ 一次授权
→ 自动连接本地数据
→ 识别 Token 浪费来源
→ 选择合适的优化策略
→ 安全配置并执行
→ 监测任务是否仍然成功
→ 展示可信节省结果
```

产品不应要求普通用户理解：

- Hook、MCP、Proxy、Adapter；
- 各压缩项目的安装命令；
- Claude Code 或 Codex 的内部目录；
- 哪一种策略适合哪种浪费；
- 多个策略是否冲突；
- 哪个节省数字是估算、测量或验证结果。

普通用户应只看到：

```text
扫描工具 → 连接一次 → 开始优化 → 查看结果
```

高级用户应保留 Strategy Hub，用于：

- 手动启用或排除策略；
- 查看风险等级；
- 查看兼容客户端；
- 查看版本与本地 Runtime；
- 查看数据来源、回滚能力和安装细节；
- 覆盖自动路由决策。

## 1.2 核心差异化

Token Saver 的优势不能只是“帮助安装 RTK”。真正的差异化应来自：

1. **跨 Agent 连接层**：Codex、Claude Code，后续扩展 OpenCode、Cursor、Hermes、OpenClaw；
2. **跨 Strategy 编排层**：RTK、内置 Tool Result Isolation，后续接入更多工具；
3. **统一浪费诊断**：重复读取、重复结果、大输出、长指令、Prefix Drift、返工；
4. **统一证据模型**：Verified / Measured locally / Estimated；
5. **统一回滚和授权**：每个修改都可解释、可撤销、有备份；
6. **统一效果证明**：最终目标是 Cost per successful task，而不是单纯压缩比例。

## 1.3 用户体验原则

必须长期遵循：

- `less is more`；
- 简单能力面向普通用户，复杂能力包装在高级设置中；
- 默认 Automatic，保留 Manual；
- 一次授权后自动同步，不反复要求用户配置；
- UI 使用浅色、清晰、准确、可信的数据工具风格；
- 不再回到厚重紫色赛博 UI；
- 不把“AI 健康检查”作为核心卖点；
- 健康、稳定、成功率只能作为优化质量护栏；
- 首页核心应是节省、连接状态、优化状态和证据质量。

---

# 2. 不能更改或不能遗漏的要求

以下要求是产品与工程底线。

## 2.1 数据准确性

所有数据必须明确分级：

### Verified

只有满足以下条件才能写成 Verified：

```text
可比较的任务
+ 优化前 Usage
+ 优化后 Usage
+ 已知 Strategy 与版本
+ 任务结果仍然成功
```

### Measured locally

可直接本地观测的数据：

- 命令数；
- Tool Result 原始字符数；
- 压缩后字符数；
- 文件读取次数；
- 重复结果次数；
- Hook 事件数；
- 任务状态信号。

### Estimated

以下只能写成估算：

- 字符数除以 4 得到的 Token；
- RTK 自身输出的 Token Savings；
- Doctor 推测的潜在节省；
- 根据价格表推算的成本。

禁止：

- 将 RTK 数据写成官方计费 Token；
- 将 Codex rollout Usage 写成最终账单；
- 将 Claude Code Hook 事件推算成官方 Usage；
- 将潜在节省写成已节省；
- 将 Baseline 写成 Verified。

## 2.2 状态准确性

必须区分：

```text
Detected        发现安装目录或程序
Authorized      用户明确授权
Connected       授权存在且连接器配置已验证
Optimization active  策略已配置并真实生效
```

仅发现 `.claude` 或 `.codex` 目录不能显示 Connected。

## 2.3 本地优先与隐私

- 默认不上传任何 Prompt、Tool Result、会话或凭证；
- 不读取 Codex 凭证；
- 不存储 API Key；
- 所有 Hook、Vault、事件、Grant、SQLite 均在本地；
- 原始内容默认应最小化保存；
- 后续需要增加敏感信息清理、Vault 保留周期和空间上限；
- UI 必须清楚说明授权范围；
- 清除 Workspace 不应暗中改变连接器授权，Disconnect 和 Clear Data 必须是两个概念。

## 2.4 修改配置的安全要求

每一个会修改本地工具配置的功能必须：

- 先展示将修改什么；
- 用户显式确认；
- 修改前备份；
- 安装、启用、停用必须幂等；
- 只能删除 Token Saver 自己写入的精确配置；
- 失败时不破坏用户原配置；
- 支持可逆；
- 不能静默执行中高风险策略。

## 2.5 外部工具与许可证

- RTK、Headroom、Claw Compactor 等保持独立所有权；
- 不得伪装为 Token Saver 自研；
- 不得删除来源、许可证和版本信息；
- 不应直接复制或重新打包不允许的代码；
- Token Saver 的价值是连接、策略、路由、回滚和证明。

---

# 3. 当前仓库与版本状态

## 3.1 主分支

当前 `main` 最新关键提交：

```text
07db0166c7b223dc04876b5830807454e8876709
Add automatic Codex and Claude Code connectors
```

已合并的主要 PR：

- PR #20：修复签名应用内更新并发布 v1.0.5；
- PR #21：浅色、清晰、数据优先 UI；Automatic / Manual；Strategy Hub；证据标签；
- PR #22：一键 RTK Adapter；
- PR #23：Codex 和 Claude Code 自动连接器。

## 3.2 当前开放 PR

### PR #26

```text
Add built-in large tool-result isolation for Claude Code
```

状态：

- Open；
- 非 Draft；
- Mergeable；
- CI Run #153 已成功；
- 尚未合并；
- 尚未完成真实 Claude Code 端到端兼容性验证。

分支：

```text
feat/tool-result-isolation-clean
```

Head：

```text
f4091f20afd6c2d190d5ac693086b3799fc2d396
```

PR #24 和 #25 已关闭，它们是旧的堆叠分支方案；不要重新启用。PR #26 是清理后的正式分支。

## 3.3 当前版本

以下文件都为 `1.0.5`：

- `package.json`；
- `src-tauri/Cargo.toml`；
- `src-tauri/tauri.conf.json`。

版本同步由：

- `scripts/check-version-sync.mjs`；
- `scripts/set-version.mjs`；
- `npm run version:check`。

控制。

---

# 4. 已经完成的功能

## 4.1 桌面应用基础

技术栈：

- Tauri 2；
- TypeScript；
- Vite；
- Rust；
- SQLite；
- Node.js 20+；
- 当前 CI 使用 Node 22。

支持：

- Web Preview；
- Tauri Desktop；
- 本地状态存储；
- JSON 导入；
- Demo Workspace；
- 本地导出；
- 本地数据清除；
- macOS 签名构建诊断；
- 应用内更新。

## 4.2 UI 与产品结构

当前导航：

```text
Overview
Opportunities
Strategy Hub
Proof
Sessions
Integrations
Settings
```

已实现：

- 浅色清晰界面；
- 一次扫描作为主要入口；
- Automatic / Manual 两种模式；
- 高级 Strategy Hub 折叠复杂性；
- Verified / Measured / Estimated 标签；
- Detected / Connected 区分；
- Connector 权限说明；
- Strategy 版本、风险、Runtime、兼容性和来源展示。

## 4.3 Doctor 分析

已有六类确定性规则：

1. repeated-file-read；
2. repeated-tool-result；
3. large-tool-output；
4. long-instruction；
5. prompt-prefix-drift；
6. possible-rework。

Doctor 会：

- 对标准化 Session Events 运行分析；
- 生成 Finding；
- 估算潜在 Token；
- 生成 Fix Proposal；
- 匹配 Strategy Registry。

注意：Doctor 的潜在节省仍然是 Estimated。

## 4.4 Strategy Hub

当前外部 Registry：

- RTK；
- Headroom；
- Claw Compactor。

Strategy 数据包括：

- ID、名称、仓库、许可证；
- 风险等级；
- 安装命令；
- 可执行文件；
- 能力标签；
- 兼容 Agent；
- 适用 Finding；
- 本地 Runtime 状态；
- Upstream 版本；
- 用户是否允许进入自动路由。

当前自动路由只完成**决策计划**，不是完整执行引擎。规则大致为：

- 无 Finding、无兼容 Agent、版本 Blocked：not-applicable；
- Manual：用户手动决定；
- Automatic + Low Risk + Enabled：automatic；
- Medium/High Risk：review。

## 4.5 RTK Adapter

已合并到 `main`。

能力：

- 检查 RTK 是否安装；
- 搜索 GUI 常见路径：
  - `~/.local/bin/rtk`；
  - `~/.cargo/bin/rtk`；
  - `/opt/homebrew/bin/rtk`；
  - `/usr/local/bin/rtk`；
  - PATH 中的 `rtk`；
- 使用 `rtk --version` 与 `rtk gain --all --format json` 验证是否为正确程序；
- 检测同名错误程序；
- 从官方 Release 下载对应平台资产；
- 校验官方 SHA-256；
- 检查压缩包路径穿越；
- 安装到 `~/.local/bin/rtk`；
- 调用 `rtk init -g --auto-patch` 配置 Claude Code；
- 调用 `rtk init -g --uninstall` 回滚；
- 显示命令数量、平均压缩比例和 RTK 估算节省。

边界：

- 当前一键配置只针对 Claude Code；
- 没有 Codex RTK 自动配置；
- RTK Token Savings 必须继续标记 Estimated；
- 当前自动安装只支持 macOS / Linux；
- Windows 只保留后续扩展。

## 4.6 Codex 连接器

已合并到 `main`。

模式：

```text
Read-only local history sync
```

读取目录：

```text
~/.codex/sessions
~/.codex/archived_sessions
```

能力：

- 用户一次授权；
- 保存本地 Grant；
- 扫描 JSONL Rollout；
- 只接受含 `session_meta` 的 Codex 文件；
- 单文件最大 32 MB；
- 每次最多处理 120 个文件；
- 解析消息、Tool Records、完成状态和 Token Count；
- 使用源文件路径生成稳定 Session ID；
- Rollout 增长后更新旧 Session，而不是重复创建；
- 启动时自动同步已授权连接器；
- 支持手动 Sync Now；
- 支持 Disconnect。

边界：

- 这是本地历史同步，不是 Codex 实时控制；
- 不是 Codex App Server 长连接；
- 不是实时 Watcher；
- 目前不能自动优化 Codex；
- Rollout 中的 Usage 是 persisted provider usage，不应称为最终账单。

## 4.7 Claude Code 事件连接器

已合并到 `main`。

用户授权后：

- 备份 `~/.claude/settings.json`；
- 创建本地 Collector Script；
- 注册异步 Hooks；
- Hook 输出写入 `~/.token-saver/events/claude-code`；
- Token Saver 启动或用户点击 Sync 时导入；
- Workspace 成功保存后再删除已确认事件文件。

当前事件：

```text
SessionStart
UserPromptSubmit
PostToolUse
PostToolUseFailure
PreCompact
Stop
SessionEnd
```

能力：

- 标准化为统一 Session / Event；
- 记录 Prompt、工具名、路径、工具结果和生命周期；
- 用于 Doctor 分析；
- 支持 Disconnect；
- Disconnect 只删除 Token Saver 自己的 Handler；
- 无法解析的事件不自动删除。

边界：

- Hook 不提供官方计费 Token；
- Claude Session Usage 保持 0，而不是伪造；
- 当前没有持续文件监听，只在应用启动或手动 Sync 时导入；
- Hook 事件可能包含 Prompt、路径和 Tool Result，虽为本地保存，但仍需后续增加敏感内容控制。

## 4.8 Proof Ledger

已实现：

- 本地 SQLite `token-saver.db`；
- Web Preview 使用浏览器存储；
- SQLite 失败时回退到 Workspace Storage；
- Proof Write Journal；
- Baseline Records；
- `before` / `after` 数据结构；
- Strategy ID 与版本字段；
- Provenance；
- Clear Ledger。

当前真实状态：

- Baseline 自动生成；
- Verified 数据模型已存在；
- 自动生成 After Snapshot、匹配可比较任务、自动判定成功率尚未完成；
- 因此首页 Verified Saved 可能长期为 0，这是正常且诚实的表现。

## 4.9 更新与构建

已完成：

- Tauri Updater；
- GitHub Release `latest.json`；
- Release Config 动态注入 Updater Public Key；
- 签名私钥由 GitHub Secrets 提供；
- CI 中 macOS ARM64 构建；
- `codesign --verify --deep --strict`；
- 前端、Rust 和签名包诊断 Artifact。

重要：

- 仓库中的 `tauri.conf.json` Updater `pubkey` 为空是有意设计；
- Release 时由 `scripts/write-release-config.mjs` 写入临时 Release Config；
- 不得把私钥或密码提交到仓库；
- 当前 macOS 使用 ad-hoc signing identity `-`；
- 尚未使用 Apple Developer ID 和 Notarization；
- 不能对外宣称“已通过 Apple 公证”。

---

# 5. 当前代码结构和关键文件

## 5.1 前端入口与状态

### `src/main.ts`

核心职责：

- 应用启动；
- Workspace Hydration；
- Proof 初始化与回退；
- 页面路由；
- 文件导入；
- 工具检测；
- Connector Runtime 启动；
- RTK 安装、启用、停用；
- Strategy Registry 更新；
- App Update；
- UI 事件绑定。

此文件已经较大，后续应继续把 Strategy Executor、Update Runtime、Import Runtime 拆出，避免继续膨胀。

### `src/types.ts`

统一领域模型，包括：

- AgentSession；
- SessionEvent；
- TokenUsage；
- Finding；
- Integration；
- ConnectorStatus；
- CompressionStrategy；
- RtkAdapterStatus；
- ProofRecord；
- FixProposal；
- WorkspaceState。

PR #26 会在此增加 `ToolResultIsolationStatus` 和 `IsolationStats`。

### `src/core/store.ts`

Workspace Local Storage、导出与清除。

## 5.2 Adapter 与 Connector

### `src/adapters/codex.ts`

Codex JSONL 正常化入口。

### `src/adapters/codex-format.ts`

Codex 不同事件格式、Token Count、Tool Record 的兼容解析。

### `src/adapters/claude-hooks.ts`

将 Claude Hook JSON 标准化为 AgentSession：

- 根据 Session ID 分组；
- 生成 Event；
- 计算本地字符估算；
- 保留 malformed 文件；
- 不伪造 Token Usage。

### `src/core/connectors.ts`

前端到 Tauri Commands 的封装。

### `src/core/connector-runtime.ts`

连接器业务流程：

- Inspect；
- Connect；
- Sync；
- Disconnect；
- 合并增量 Session；
- 同步 Findings、Fix Proposals、Proof Baselines；
- 启动时自动同步。

## 5.3 Doctor 与 Import

### `src/core/import-router.ts`

统一导入入口，识别 Codex 和通用格式。

### `src/core/analyzer-v1.ts`

Doctor 规则实现。

### `src/core/hash.ts`

稳定 ID 与内容 Hash。

## 5.4 Strategy

### `src/strategies/registry.ts`

外部策略定义、Recommendation Mapping、保存状态合并。

### `src/strategies/policy.ts`

Automatic / Manual 路由决策计划。

### `src/strategies/runtime.ts`

把本地 Runtime Detection 写回 Strategy 状态。

### `src/strategies/updates.ts`

上游 Release 检查。

### `src/fixes/proposals.ts`

Finding 到 Fix Proposal 的转换。

## 5.5 Proof

### `src/proof/ledger.ts`

Session → Baseline Snapshot。

### `src/proof/database.ts`

SQLite 读写、Upsert、Fallback。

### `src/proof/write-journal.ts`

串行持久化和错误恢复，避免清除与写入竞争。

### `src/ui/proof.ts`

Proof Ledger UI。

## 5.6 UI

### `src/ui/templates.ts`

Overview、Opportunities、Sessions、Integrations、Settings 等页面。

### `src/ui/strategies.ts`

Strategy Hub、RTK Card、路由摘要、高级策略控制。

### `src/ui/connectors.css`

连接器 UI。

### `src/ui/format.ts`

数字、日期、货币、HTML Escape。

### `src/styles.css` / `src/strategy.css`

全局浅色视觉与 Strategy Hub 样式。

## 5.7 Rust / Tauri

### `src-tauri/src/main.rs`

- 注册 Tauri Plugins；
- 注册 Commands；
- Integration Detection；
- Strategy Runtime Detection；
- Release URL 限制。

### `src-tauri/src/agent_connectors.rs`

- Connector Grant；
- Codex 文件扫描；
- Claude Settings 读写；
- Hook 添加与删除；
- Event File 读取与确认；
- Connector 状态。

### `src-tauri/src/claude_collector.rs`

生成兼容 macOS/BSD `mktemp` 的原子事件 Collector Script。

### `src-tauri/src/rtk_adapter.rs`

RTK 检查、配置、回滚、Gain 解析。

### `src-tauri/src/rtk_installer.rs`

RTK 官方 Release 下载、Checksum 验证、Tar 安全检查、安装。

### `src-tauri/src/proof_db.rs`

SQLite Migration。

### `src-tauri/src/app_updates.rs`

Updater Plugin 与 GitHub Release Fallback。

### PR #26：`src-tauri/src/tool_result_isolator.rs`

尚未合并。大型 Tool Result 本地隔离与 Headless Hook Runtime。

## 5.8 文档和脚本

关键文档：

- `docs/AUTOMATIC_CONNECTORS.md`；
- `docs/STRATEGY_HUB.md`；
- `docs/V1.md`；
- `docs/BENCHMARKS.md`；
- `ROADMAP.md`；
- PR #26 中的 `docs/TOOL_RESULT_ISOLATION.md`。

关键脚本：

- `scripts/check-version-sync.mjs`；
- `scripts/check-startup-safety.mjs`；
- `scripts/write-release-config.mjs`；
- `scripts/set-version.mjs`；
- `scripts/validate-strategy-registry.mjs`；
- `scripts/sync-strategy-registry.mjs`。

CI：

- `.github/workflows/ci.yml`。

---

# 6. 已确定的技术方案

## 6.1 总体架构

```text
Tauri Desktop UI
       │
WorkspaceState + SQLite Proof Ledger
       │
Connectors ── Normalize Session/Event ── Doctor
       │                                │
       │                                Findings
       │                                   │
       └──────────────────────────── Strategy Policy
                                           │
                          Built-in / External Strategy Adapters
                                           │
                             Measured / Estimated / Verified
                                           │
                                      Proof Ledger
```

## 6.2 Connector 与 Strategy 必须分离

Connector：观察。

- Codex History Connector；
- Claude Event Connector。

Strategy：改变上下文传递方式。

- RTK；
- Tool Result Isolation；
- 后续 Context Cache、MCP Schema Pruning、Prompt Compression。

不要把“连接到工具”与“优化工具”混成同一状态。

## 6.3 普通用户与高级用户双层产品

普通模式：

- Automatic；
- 推荐一个主要操作；
- 只自动执行已授权、兼容、低风险策略；
- 隐藏内部配置细节。

高级模式：

- Manual；
- Strategy Hub；
- 查看所有 Registry、Runtime、风险和路由；
- 手动启用、停用和排除。

## 6.4 RTK 定位

RTK 是外部命令输出优化引擎，负责 Bash / Git / Test / Logs。

Token Saver 负责：

- 安装；
- 校验；
- 兼容性；
- 授权；
- 配置；
- 状态；
- 结果聚合；
- 回滚。

## 6.5 Tool Result Isolation 定位

PR #26 的目标是处理 RTK 不覆盖的非终端大型结果：

```text
完整 Tool Response 保存到本地 Vault
→ 保留 JSON 结构
→ 只缩短大型字符串字段
→ Claude 接收 Preview + Vault Path
→ 必要时按 offset / limit 读取原文
```

初始范围：

- Read；
- Grep；
- Glob；
- WebFetch；
- WebSearch；
- MCP Tools。

排除：

- Bash；
- Write；
- Edit；
- Image；
- 小输出；
- 对 Vault 自身的读取。

## 6.6 Proof 方向

最终核心指标：

```text
Cost per successful task
```

不是：

- 单次压缩比例；
- 字符减少；
- 理论最大节省。

后续 Proof Comparator 必须：

- 识别同类任务；
- 保存 Strategy、版本和配置；
- 记录 Before / After；
- 验证任务状态；
- 统计重试、返工、重复读取；
- 输出 Verified Savings。

---

# 7. 尚未解决的问题

## 7.1 PR #26 尚未实机验证

CI 已通过只证明：

- TypeScript 正确；
- Rust 编译正确；
- Unit Tests 通过；
- macOS 包可以构建和签名。

还没有证明：

- Claude Code 接受当前 Hook Schema；
- `command` + `args` 配置格式被当前 Claude Code 版本支持；
- `updatedToolOutput` 对每一种 Tool Output Shape 都有效；
- Read、Grep、Glob、WebFetch、WebSearch、MCP 都能正常工作；
- Hook 失败时 Claude 一定收到原始结果；
- Vault 路径可被 Claude 正确读取；
- App 更新后 Hook 路径仍然有效。

因此 PR #26 不能仅凭 CI 自动合并并发布。

## 7.2 Hook 可执行路径稳定性

PR #26 使用 `env::current_exe()` 写入 Claude Settings。

风险：

- macOS App Translocation；
- 用户移动 `.app`；
- App 更新后 Bundle Path 变化；
- 用户删除 App 后残留 Hook；
- Hook 调用 GUI App Binary 可能有启动成本或 Gatekeeper 行为。

建议：

- 安装一个稳定的本地 Helper 到 `~/.local/bin/token-saver-hook` 或 `~/.token-saver/bin/`；
- Hook 永远调用稳定 Helper；
- App 更新时原子替换 Helper；
- 启动时检查并修复 Stale Hook；
- 禁止把 `/private/var/folders/.../AppTranslocation/...` 路径写入配置。

## 7.3 Tool Result Isolation 的数据安全

PR #26 会保存完整 Tool Response。

待解决：

- 敏感信息 Redaction；
- Vault 最大空间；
- 文件保留时间；
- 一键清除 Vault；
- 每个项目隔离；
- 可选“不保存完整原文，只做摘要”的模式；
- 避免原始结果中包含 Secret、Token、个人数据。

## 7.4 Tool Result Isolation 尚未进入 Proof Ledger

当前 PR #26 只：

- 写 JSONL Strategy Event；
- 显示原始字符、Delivered 字符和 Estimated Token。

尚未：

- 与 Session ID 完整关联；
- 写入 SQLite Proof Record；
- 生成 After Snapshot；
- 验证任务成功；
- 形成 Verified Savings。

## 7.5 Codex 只有观察，没有优化

当前 Codex：

- 能检测；
- 能授权；
- 能同步历史；
- 能读取已持久化 Usage；
- 能运行 Doctor。

当前 Codex 不能：

- 自动接入 RTK；
- 自动隔离 Tool Result；
- 自动改变 Context；
- 实时接收 App Server Event；
- 运行 Strategy Executor。

不能对用户宣传“Codex 已自动优化”。

## 7.6 没有持续实时同步

当前连接器只在：

- Token Saver 启动；
- 用户点击 Sync Now。

进行同步。

没有：

- File Watcher；
- 定时增量同步；
- 后台 Event Consumer；
- Cursor / Offset 持久化。

Codex 每次最多重读 120 个 Rollout；Claude 每次最多读取 500 个事件。

建议增加：

- Debounced File Watcher；
- 每个源的 Cursor / MTime / Hash；
- 事件去重；
- Backpressure；
- App 退出时 Flush。

## 7.7 Automatic Routing 不是完整执行

当前 `buildStrategyRoutePlan()` 只生成决策。

尚未存在统一：

```text
Finding
→ Route Plan
→ Approval Policy
→ Adapter Apply
→ Health Check
→ Rollback
→ Proof Record
```

RTK 和 Tool Result Isolation 仍然由独立按钮启用，尚未由统一 Strategy Executor 驱动。

## 7.8 README 已过时

当前 `README.md` 仍写着：

- V1 不自动执行策略；
- 不自动导入；
- 不修改配置；
- Strategy Hub 只有 Registry。

这些已经与 PR #22、#23 不一致。

合并 PR #26 或发布 v1.1.0 前必须更新：

- README.md；
- README_CN.md；
- docs/V1.md；
- ROADMAP.md；
- 架构图；
- 功能矩阵；
- 当前限制。

## 7.9 发布与公证

当前有签名更新，但：

- macOS 是 ad-hoc signing；
- 无 Apple Developer ID；
- 无 Notarization；
- 用户仍可能看到 Gatekeeper 提示。

发布给大量普通用户前需要：

- Developer ID Application；
- Notarization；
- Stapling；
- 更新签名链路；
- 重新验证 Updater Artifact。

## 7.10 Windows 和 Linux 验证不足

- RTK 安装逻辑包含 Linux；
- 主 CI Rust Check 在 Linux；
- 正式桌面包主要验证 macOS ARM64；
- Windows Hook、Installer、Updater 未完成真实测试；
- 不得宣传完整跨平台。

---

# 8. 最近一次修改内容

最近完成并进入主分支的是 PR #23：

```text
Add automatic Codex history and Claude Code event connectors
```

主要变化：

- 新增 `src-tauri/src/agent_connectors.rs`；
- 新增 `src-tauri/src/claude_collector.rs`；
- 新增 `src/core/connectors.ts`；
- 新增 `src/core/connector-runtime.ts`；
- 新增 `src/adapters/claude-hooks.ts`；
- 增强 Codex Rollout 导入；
- 增加 Connector Status、Data Quality；
- 增加 Integrations 一键授权、同步、断开；
- 启动时自动同步已授权连接器；
- 导入完成后才确认删除 Claude Event Files；
- 增加相关 TypeScript 和 Rust 测试；
- 增加 `docs/AUTOMATIC_CONNECTORS.md`。

最近正在进行的是 PR #26：

```text
Add built-in large tool-result isolation for Claude Code
```

主要变化：

- 新增 Rust Headless Hook Runtime；
- 新增本地 Vault；
- 保留 JSON Shape，只压缩大型字符串；
- 排除 Bash / Write / Edit / Image / Vault Read；
- 记录 Strategy Event；
- Strategy Hub 新增内置隔离卡片；
- 显示 Measured Characters 与 Estimated Tokens；
- 新增启用、停用、状态刷新；
- 新增文档与测试；
- CI 已成功；
- 尚未实机验证与合并。

---

# 9. 下一步具体任务

以下按优先级执行。

## P0：完成 PR #26 的真实验证

### 任务 1：检查 Claude Hook Schema

确认当前 Claude Code 正式版本支持：

```json
{
  "type": "command",
  "command": "...",
  "args": ["--claude-tool-result-hook"]
}
```

若不支持 `args`，改成安全引用后的单一 Command String，不能直接字符串拼接未转义路径。

### 任务 2：验证 `updatedToolOutput`

逐个真实测试：

- Read；
- Grep；
- Glob；
- WebFetch；
- WebSearch；
- 至少两个 MCP Tool。

每项记录：

- 原始 Shape；
- 更新后 Shape；
- Claude 是否接受；
- 是否产生 Hook Error；
- 是否可从 Vault 精确读取；
- 任务是否仍成功。

### 任务 3：改用稳定 Helper Path

不要长期把当前 App Executable Path 写进 Hook。

实现：

```text
~/.token-saver/bin/token-saver-hook
```

或等价稳定路径。

同时处理：

- App Translocation；
- App 更新；
- App 移动；
- Stale Hook 修复；
- App 卸载残留。

### 任务 4：验证 Fail-open

制造以下故障：

- Vault 无写权限；
- JSON 无法解析；
- Event Log 无法写入；
- Helper 不存在；
- Output Shape 不兼容；
- 处理超过 Timeout。

必须确保：

- 不阻塞 Claude；
- 不破坏任务；
- 不返回半截结果；
- UI 能提示策略健康异常。

### 任务 5：Vault 安全与生命周期

增加：

- 单文件上限；
- 总目录上限；
- 默认保留时间；
- 清除按钮；
- Redaction；
- 项目隔离；
- Vault Read Loop 防护的 canonical path 检查。

完成以上任务后再决定是否合并 PR #26。

## P0：统一 Strategy Executor

新建建议文件：

```text
src/strategies/executor.ts
src/strategies/adapters/rtk.ts
src/strategies/adapters/tool-result-isolation.ts
```

统一接口建议：

```ts
interface StrategyAdapter {
  inspect(): Promise<StrategyRuntimeStatus>;
  preview(context: StrategyContext): Promise<StrategyChangePreview>;
  apply(context: StrategyContext): Promise<StrategyApplyResult>;
  verify(context: StrategyContext): Promise<StrategyHealthResult>;
  rollback(context: StrategyContext): Promise<StrategyRollbackResult>;
}
```

统一流程：

```text
Doctor Finding
→ Policy Decision
→ Explicit Approval when needed
→ Adapter Apply
→ Verify
→ Write Proof Applied Record
→ Observe Outcome
→ Write After Snapshot
→ Verify or Roll Back
```

## P0：Proof Comparator

实现：

- Session Fingerprint；
- Comparable Task Matching；
- Before / After Pair；
- Strategy ID / Version；
- Success Preservation；
- Retry / Rework Penalty；
- Verified Savings；
- Cost per successful task。

没有 Comparator 前，不要把本地字符减少写成 Verified。

## P1：Codex 优化路径

先研究官方可支持路径，再编码：

- Codex App Server；
- Codex MCP；
- Codex Config / Hooks；
- Wrapper / Shell Command Interception；
- Tool Result 层是否可插入。

要求：

- 使用官方能力；
- 不修改凭证；
- 不破坏 Codex 自动更新；
- 不用脆弱的 UI 自动化；
- 不在不支持时伪装成已优化。

## P1：持续同步

增加：

- Codex Rollout Watcher；
- Claude Event Directory Watcher；
- 增量 Cursor；
- Hash 去重；
- Debounce；
- 自动 Flush；
- 连接健康状态。

## P1：统一 Savings Dashboard

按 Strategy 和 Agent 展示：

```text
Claude Code
  RTK Estimated
  Tool Isolation Measured + Estimated
  Verified Comparable Tasks

Codex
  Persisted Usage
  Findings
  Future Optimization Outcomes
```

所有数字必须带 Evidence Label。

## P1：更新文档与发布 v1.1.0

发布前：

1. 更新 README / README_CN；
2. 更新 V1 / Roadmap / Architecture；
3. 写真实安装与卸载说明；
4. 写隐私与本地文件清单；
5. 写 RTK 来源与许可证；
6. 写 Connector 权限说明；
7. 写数据质量说明；
8. 更新版本到 1.1.0；
9. 构建签名 Artifact；
10. 生成 Updater JSON；
11. 做从 v1.0.5 升级测试。

## P2：后续 Strategy

建议顺序：

1. Repeated Read Cache / Code Intelligence；
2. MCP Schema Lazy Loading / Pruning；
3. Session Compaction；
4. Prompt Compression，默认 Opt-in；
5. Model Routing，最后考虑。

---

# 10. 测试与开发命令

## 10.1 环境

```text
Node.js >= 20
npm
Rust Stable
Tauri 2 系统依赖
```

## 10.2 安装

```bash
npm install
```

## 10.3 Web Preview

```bash
npm run dev
```

注意：Web Preview 无法运行 Tauri Connector、RTK、SQLite Native 和本地 Hook。

## 10.4 Desktop Dev

```bash
npm run desktop:dev
```

## 10.5 检查

```bash
npm run check
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

## 10.6 Desktop Build

```bash
npm run desktop:build
```

Bundle：

```text
src-tauri/target/release/bundle/
```

## 10.7 PR 必须通过

- TypeScript Check；
- Node Tests；
- Frontend Build；
- Cargo Check；
- Rust Tests；
- macOS Release Build；
- Codesign Verify。

CI 通过不能替代真实 Claude / Codex 实机测试。

---

# 11. 本地文件与权限清单

当前可能创建或读取：

## Token Saver

```text
~/.token-saver/connectors/*.json
~/.token-saver/hooks/claude-event-collector.sh
~/.token-saver/events/claude-code/*.json
```

PR #26：

```text
~/.token-saver/vault/claude-code/*.json
~/.token-saver/strategy-events/tool-result-isolation.jsonl
```

SQLite：

```text
token-saver.db
```

具体物理位置由 Tauri SQL Plugin App Data Directory 决定。

## Claude Code

```text
~/.claude/settings.json
~/.claude/hooks/rtk-rewrite.sh
```

备份：

```text
~/.claude/settings.json.token-saver-backup-*
```

## Codex

只读：

```text
~/.codex/sessions
~/.codex/archived_sessions
```

不得读取或导出 Codex 凭证。

## RTK

```text
~/.local/bin/rtk
```

也会检测：

```text
~/.cargo/bin/rtk
/opt/homebrew/bin/rtk
/usr/local/bin/rtk
PATH
```

---

# 12. 已知对外表达边界

目前可以说：

- Token Saver 能自动检测本地 AI 工具；
- Codex 可在一次授权后同步本地 Rollout 历史；
- Claude Code 可在一次授权后捕获本地生命周期和工具事件；
- Token Saver 可一键安装并配置 RTK 到 Claude Code；
- Token Saver 能识别多类上下文浪费；
- Token Saver 能区分估算、测量和验证数据；
- PR #26 正在加入内置大型 Tool Result Isolation。

目前不能说：

- Codex 已自动优化；
- Claude Code 官方 Token Usage 已准确获取；
- 所有节省数据都是真实账单数据；
- Verified Savings 已完整闭环；
- Tool Result Isolation 已经过生产验证；
- 已支持所有 AI Agent；
- 已完成 Apple Notarization；
- 已完整支持 Windows。

---

# 13. 产品决策记录

## 已放弃或修正的方向

### 不再以“AI Health”作为核心定位

健康检查、稳定性和失败率只作为优化质量验证，不是首页主卖点。

### 不再追求厚重紫色赛博风

用户明确偏好：

- 浅色；
- 清晰；
- 准确；
- 高级但克制；
- 数据工具感。

### Strategy Hub 不能删除

Strategy Hub 是原产品的重要部分，面向高级用户。普通用户不应被迫配置，但高级用户必须保留选择能力。

### 不能只做 RTK Wrapper

RTK Adapter 只是第一块能力。Token Saver 必须继续完成：

- Connector；
- Built-in Strategy；
- Routing；
- Unified Ledger；
- Verified Outcome。

---

# 14. 推荐的新对话开场指令

可把下面文字直接发给新的开发对话：

```text
请接手 GitHub 仓库 SiruGao/token-saver。
先阅读 docs/PROJECT_HANDOFF.md，然后检查 main、PR #26 和最新 CI。
不要重新设计产品方向，不要大改浅色 UI，不要删除 Strategy Hub。
优先完成 PR #26 的真实 Claude Code 端到端验证、稳定 Helper Path、Fail-open、Vault 安全和 Proof Ledger 接入。
所有数据必须严格区分 Verified、Measured locally 和 Estimated。
Detected 不等于 Connected，Connected 不等于 Optimization active。
Codex 当前只有本地历史观察，没有自动优化，不能夸大。
每次修改本地配置都必须显式授权、备份、幂等、可撤销。
先报告当前真实状态和风险，再开始修改代码。
```

---

# 15. 最终接手判断

当前项目已经越过“静态 UI 原型”阶段，进入真实桌面运行时阶段。

已经建立：

```text
连接层
+ 标准化事件层
+ Doctor
+ Strategy Registry
+ 第一个外部 Adapter
+ Proof 数据结构
```

尚未完全建立：

```text
统一 Strategy Executor
+ 第二个经过实机验证的内置 Strategy
+ Codex 优化
+ 持续同步
+ 自动 Before/After Comparator
+ Verified Savings 闭环
```

下一位接手者最重要的任务不是继续增加页面，而是把现有模块接成一个可证明有效、不会伤害任务质量、普通用户可以一键使用的完整闭环。