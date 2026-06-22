# Token Saver Desktop 中文说明

> 英文版 [README.md](README.md) 是规范文档，本页提供中文概览。

## 项目定位

Token Saver 是一款**本地优先的 AI Agent Token 效率控制软件**。

我们不准备重新发明所有压缩算法，而是建立一个统一闭环：

```text
Doctor 诊断
→ Policy 选择
→ Strategy Adapter 调用外部方案
→ Proof 验证真实效果
```

Doctor 负责判断 Token 浪费来自哪里；Strategy Hub 负责把诊断结果匹配给兼容的第三方压缩方案；后续 Proof 层负责比较 Token、费用、返工、延迟和任务成功率。

核心指标不是压缩率，而是：

```text
每个成功任务的成本
= 模型调用、重试、重读和返工的全部成本
  ÷ 成功完成的任务数量
```

## V1 已完成

- Dashboard：Token、估算费用、潜在浪费、任务状态和 Agent 分布；
- Doctor：六类确定性浪费规则，提供证据和改进建议；
- Strategy Hub：第三方策略注册表、风险等级、兼容信息、Doctor 推荐、上游版本检查和用户选择；
- 初始策略：RTK、Headroom 和 Claw Compactor；
- Sessions：单次任务的调用时间线与诊断结果；
- Integrations：检测 Claude Code、Codex、OpenClaw、Hermes、OpenCode 和 Cursor 是否安装；
- 明确导入：用户主动拖拽或选择 JSON、JSONL、TXT 会话文件；
- usage 归一化：优先读取常见 Provider usage 字段，没有时才估算；
- 本地保存、清除和 JSON 报告导出；
- macOS、Windows 和 Linux 构建工作流。

V1 只负责观察、诊断、推荐和版本可见性，不会自动安装或执行第三方策略，也不会修改 Prompt、命令、工作区或 Agent 配置。

## 核心竞争力

单纯收集几个压缩工具很容易被复制。真正的壁垒是：

- 跨 Agent 的统一会话和任务数据结构；
- Doctor 诊断与策略效果之间的长期数据；
- 不同策略、版本、Agent、模型和内容类型之间的兼容矩阵；
- 安全更新、健康检查、固定版本、灰度使用和回滚；
- 以“每个成功任务的成本”衡量效果，而不是只展示 Token 压缩比例；
- 不绑定单一压缩厂商的中立策略层。

详细设计见 [docs/STRATEGY_HUB.md](docs/STRATEGY_HUB.md)。

## 运行

```bash
npm install
npm run dev          # 网页预览
npm run desktop:dev  # 桌面开发模式
npm run desktop:build
```

构建结果位于：

```text
src-tauri/target/release/bundle/
```

## 隐私

- 不需要账号；
- V1 没有遥测；
- 分析在本地运行；
- 不上传会话文件；
- 原生端只判断已知应用目录是否存在，不读取其中的文件；
- 只有用户明确选择或拖入的会话文件才会进入分析器；
- 策略更新检查只读取公开的 GitHub Release 元数据；
- 可以在 Settings 中导出或删除本地数据。

## OpenClaw Skill

原来的 `SKILL.md` 继续保留，但它现在只是一个可选的 OpenClaw 集成，不是产品本体。

## 当前限制

V1 还不会执行策略适配器、自动安装上游工具、自动导入会话、代理模型请求、执行压缩、接入 Provider 账单、进行 A/B 质量回放或提供已签名公开安装包。

## 许可

MIT — 见 [LICENSE](LICENSE)。
