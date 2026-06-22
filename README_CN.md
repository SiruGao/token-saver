# Token Saver Desktop 中文说明

> 英文版 [README.md](README.md) 是项目的规范文档，本页提供中文概览。

## 项目定位

Token Saver 已从单一 OpenClaw Skill 升级为一款**本地优先的 AI Agent Token 效率桌面软件**。

它不是只显示 Token 数字，也不是单纯追求压缩率，而是分析：

- Token 消耗发生在哪里；
- 哪些内容被重复发送或读取；
- 哪些工具输出和系统提示词过大；
- Prompt Cache 是否可能因为前缀变化而失效；
- 压缩是否可能造成重复调用和返工。

核心指标是：

```text
每个成功任务的成本
= 模型调用、重试、重读和返工的全部成本
  ÷ 成功完成的任务数量
```

## V1 已完成

V1 已经包含自己的桌面 UI 和本地分析逻辑：

- Dashboard：Token、费用、潜在浪费、任务状态和 Agent 分布；
- Doctor：识别六类常见 Token 浪费；
- Sessions：查看单次任务的调用时间线与诊断结果；
- Integrations：检测 Claude Code、Codex、OpenClaw、Hermes、OpenCode 和 Cursor；
- 本地扫描：读取常见 Agent 目录中的近期 JSON、JSONL 和 TXT 会话；
- 文件导入：支持拖拽或选择本地会话文件；
- usage 归一化：优先读取 Provider usage，没有时才估算；
- 本地保存、清除和 JSON 报告导出；
- 演示工作区。

V1 是只读分析器，不会擅自修改用户 Prompt、命令或 Agent 配置。

## 运行网页预览

```bash
npm install
npm run dev
```

## 运行桌面软件

安装 Tauri 2 所需的系统依赖和 Rust 工具链后：

```bash
npm install
npm run desktop:dev
```

## 构建安装包

```bash
npm install
npm run desktop:build
```

构建结果位于：

```text
src-tauri/target/release/bundle/
```

仓库已经加入 macOS、Windows 和 Linux 的 GitHub Actions 构建工作流。

## 隐私

- 不需要账号；
- V1 没有遥测；
- 分析在本地运行；
- 不上传会话文件；
- 原生扫描只读；
- 可以在 Settings 中导出或删除本地数据。

## OpenClaw Skill

原来的 `SKILL.md` 继续保留，但它现在只是 Token Saver 的一个 OpenClaw 集成，而不是产品本体。

## 当前限制

V1 还没有实现：

- 全局 API Proxy；
- 自动 Prompt 压缩；
- Provider 账单授权；
- A/B 质量回放；
- SQLite 长期账本；
- 已签名的公开安装包；
- 对所有 Agent 版本的完美解析。

这些能力将在 V1 的真实使用数据验证后继续开发。

## 许可

MIT — 见 [LICENSE](LICENSE)。
