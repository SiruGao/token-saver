# Token Saver Desktop 中文说明

> 英文版 [README.md](README.md) 是规范文档，本页提供中文概览。

## 项目定位

Token Saver 已从单一 OpenClaw Skill 升级为一款**本地优先的 AI Agent Token 效率桌面软件**。

它分析 Token 消耗、重复读取、冗长工具输出、过大的系统提示、Prompt Cache 前缀变化，以及可能由上下文缺失造成的重复调用。

核心指标是：

```text
每个成功任务的成本
= 模型调用、重试、重读和返工的全部成本
  ÷ 成功完成的任务数量
```

## V1 已完成

- Dashboard：Token、估算费用、潜在浪费、任务状态和 Agent 分布；
- Doctor：六类确定性 Token 浪费规则；
- Sessions：单次任务的调用时间线与诊断结果；
- Integrations：检测 Claude Code、Codex、OpenClaw、Hermes、OpenCode 和 Cursor 是否安装；
- 明确导入：用户主动拖拽或选择 JSON、JSONL、TXT 会话文件；
- usage 归一化：优先读取常见 Provider usage 字段，没有时才估算；
- 本地保存、清除和 JSON 报告导出；
- 演示工作区；
- macOS、Windows 和 Linux 构建工作流。

V1 是只读分析器。它不会自动读取 Agent 文件，也不会修改 Prompt、命令或 Agent 配置。

## 运行

```bash
# 网页预览
npm install
npm run dev

# 桌面开发模式
npm run desktop:dev

# 构建本机安装包
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
- 可以在 Settings 中导出或删除本地数据。

## OpenClaw Skill

原来的 `SKILL.md` 继续保留，但它现在只是一个可选的 OpenClaw 集成，不是产品本体。

## 当前限制

V1 还没有自动导入会话、全局 API Proxy、自动 Prompt 压缩、Provider 账单接入、A/B 质量回放、SQLite 长期账本、已签名公开安装包，以及针对所有 Agent 版本的专用解析器。

## 许可

MIT — 见 [LICENSE](LICENSE)。
