import type {
  CompressionStrategy,
  Finding,
  FindingType,
  StrategyRecommendation,
} from "../types";

export const strategyRegistry: CompressionStrategy[] = [
  {
    id: "rtk",
    name: "RTK",
    description: "High-performance command-output filtering for coding agents and terminal tools.",
    repository: "rtk-ai/rtk",
    homepage: "https://github.com/rtk-ai/rtk",
    license: "Apache-2.0",
    mode: "external-cli",
    risk: "low",
    state: "available",
    installCommand: "brew install rtk",
    executable: "rtk",
    capabilities: ["command-output", "test-output", "git-output", "log-deduplication"],
    compatibleAgents: ["claude-code", "codex", "hermes", "cursor", "unknown"],
    recommendedFor: ["large-tool-output", "repeated-tool-result"],
    enabled: false,
    managedExternally: true,
  },
  {
    id: "headroom",
    name: "Headroom",
    description: "Local compression layer supporting proxy, wrapper, library, MCP, cache alignment, and reversible retrieval.",
    repository: "headroomlabs-ai/headroom",
    homepage: "https://github.com/headroomlabs-ai/headroom",
    license: "Apache-2.0",
    mode: "local-proxy",
    risk: "medium",
    state: "available",
    installCommand: "pip install \"headroom-ai[all]\"",
    executable: "headroom",
    capabilities: ["proxy", "context-routing", "cache-alignment", "reversible-compression", "mcp", "output-shaping"],
    compatibleAgents: ["claude-code", "codex", "cursor", "unknown"],
    recommendedFor: ["large-tool-output", "long-instruction", "prompt-prefix-drift", "possible-rework"],
    enabled: false,
    managedExternally: true,
  },
  {
    id: "claw-compactor",
    name: "Claw Compactor",
    description: "Deterministic workspace and transcript compaction with dry-run benchmarking and tiered summaries.",
    repository: "Niyuhang2/claw-compactor",
    homepage: "https://github.com/Niyuhang2/claw-compactor",
    license: "MIT",
    mode: "workspace-tool",
    risk: "medium",
    state: "available",
    installCommand: "git clone https://github.com/Niyuhang2/claw-compactor.git",
    capabilities: ["workspace-compaction", "transcript-compaction", "deduplication", "dry-run", "tiered-summaries"],
    compatibleAgents: ["openclaw", "unknown"],
    recommendedFor: ["repeated-file-read", "repeated-tool-result", "long-instruction"],
    enabled: false,
    managedExternally: true,
  },
];

const recommendationReason: Record<FindingType, string> = {
  "repeated-file-read": "The strategy can reduce repeated workspace or file context.",
  "repeated-tool-result": "The strategy can deduplicate or compact repeated tool output.",
  "large-tool-output": "The strategy is designed to filter or compress verbose command and tool results.",
  "long-instruction": "The strategy can compact persistent context or separate stable and dynamic instructions.",
  "prompt-prefix-drift": "The strategy includes cache-alignment or stable-prefix controls.",
  "possible-rework": "The strategy supports reversible retrieval or safer context routing for missing details.",
};

export function recommendationsForFindings(
  findings: Finding[],
  strategies: CompressionStrategy[],
): StrategyRecommendation[] {
  const findingTypes = new Set(findings.map((finding) => finding.type));
  const recommendations: StrategyRecommendation[] = [];

  for (const strategy of strategies) {
    for (const findingType of strategy.recommendedFor) {
      if (!findingTypes.has(findingType)) continue;
      const matchingFindings = findings.filter((finding) => finding.type === findingType);
      const hasHighSeverity = matchingFindings.some((finding) => finding.severity === "high");
      recommendations.push({
        strategyId: strategy.id,
        findingType,
        reason: recommendationReason[findingType],
        confidence: hasHighSeverity ? "high" : matchingFindings.length > 1 ? "medium" : "low",
      });
    }
  }

  return recommendations;
}

export function mergeStrategyRegistry(
  saved: CompressionStrategy[] | undefined,
): CompressionStrategy[] {
  const savedById = new Map((saved ?? []).map((strategy) => [strategy.id, strategy]));
  return strategyRegistry.map((registryStrategy) => {
    const previous = savedById.get(registryStrategy.id);
    return previous
      ? {
          ...registryStrategy,
          enabled: previous.enabled,
          state: previous.state,
          installedVersion: previous.installedVersion,
          latestVersion: previous.latestVersion,
          lastCheckedAt: previous.lastCheckedAt,
        }
      : { ...registryStrategy };
  });
}
