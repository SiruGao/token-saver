# Token Saver 中文说明

> 项目的规范文档、架构与贡献体系以英文版 [README.md](README.md) 为准。本页仅提供简要中文说明。

## 项目定位

Token Saver 不再只定位为“压缩 Prompt 的工具”，而是面向 AI Agent 的**质量感知 Token 效率控制层**：

```text
发现浪费 → 安全优化 → 验证任务质量 → 对账真实成本
```

核心指标不是单次压缩率，而是：

```text
每个成功任务的成本（cost per successful task）
```

如果压缩导致 Agent 重读文件、重复调用工具、返工或回答错误，那么这种“节省”并不成立。

## 当前状态

Token Saver 目前仍是一个早期 OpenClaw Skill，已经提供：

- 根据任务复杂度选择模型的行为建议；
- 长对话上下文整理；
- 减少重复文件读取和工具调用；
- 控制无效输出和冗余表达；
- OpenClaw 兼容的 `SKILL.md`。

下一阶段将开发 **Token Saver Doctor**，在本地扫描 Agent 会话和配置，识别：

- 重复上下文和重复文件读取；
- 破坏 Prompt Cache 的前缀变化；
- 冗长的 MCP Tool Schema；
- 测试、构建和命令日志膨胀；
- 本地 Token 估算与 Provider 实际 usage 不一致；
- 过度压缩引发的重试和返工。

## 安装当前 OpenClaw Skill

```bash
openclaw skills install token-saver
```

或手动安装：

```bash
mkdir -p ~/.openclaw/workspace/skills/token-saver
cp SKILL.md ~/.openclaw/workspace/skills/token-saver/SKILL.md
```

当前 Skill 属于行为策略层，不会拦截所有真实 API 请求。实际节省取决于模型、Provider、Agent、任务类型、缓存行为以及宿主是否支持模型切换。

## 差异化

Token Saver 计划把以下能力放在一个闭环里：

1. **Doctor**：解释 Token 浪费发生在哪里；
2. **Gateway**：使用去重、缓存对齐、差分上下文、延迟加载工具定义和局部可逆压缩进行优化；
3. **Proof Ledger**：记录原始输入、优化后输入、Provider usage、重试、延迟和任务结果；
4. **Quality Guard**：发现压缩后重复调用、重读和任务失败，必要时自动回退原文。

## 项目文档

- [Canonical English README](README.md)
- [Product Roadmap](ROADMAP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Benchmark Policy](docs/BENCHMARKS.md)
- [Contributing](CONTRIBUTING.md)

## 许可

CC0 1.0 Universal — 见 [LICENSE](LICENSE)。
