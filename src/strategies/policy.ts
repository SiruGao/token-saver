import type {
  AgentId,
  CompressionStrategy,
  Finding,
  FindingType,
  Integration,
  OptimizationMode,
  StrategyRisk,
} from "../types";

export type StrategyDecision = "automatic" | "review" | "manual" | "not-applicable";

export interface StrategyRoutePlan {
  strategyId: string;
  decision: StrategyDecision;
  matchingFindings: FindingType[];
  compatibleAgents: AgentId[];
  risk: StrategyRisk;
  reason: string;
}

function availableAgents(integrations: Integration[]): AgentId[] {
  const connected = integrations.filter((item) => item.connected).map((item) => item.id);
  if (connected.length) return connected;
  return integrations.filter((item) => item.detected).map((item) => item.id);
}

function matchesAgents(strategy: CompressionStrategy, agents: AgentId[]): AgentId[] {
  return agents.filter((agent) => (
    strategy.compatibleAgents.includes(agent)
    || strategy.compatibleAgents.includes("unknown")
  ));
}

export function buildStrategyRoutePlan(
  findings: Finding[],
  strategies: CompressionStrategy[],
  integrations: Integration[],
  mode: OptimizationMode,
): StrategyRoutePlan[] {
  const findingTypes = new Set(findings.map((item) => item.type));
  const agents = availableAgents(integrations);

  return strategies.map((strategy) => {
    const matchingFindings = strategy.recommendedFor.filter((type) => findingTypes.has(type));
    const compatibleAgents = matchesAgents(strategy, agents);
    const blocked = strategy.compatibilityStatus === "blocked";

    if (!matchingFindings.length || !compatibleAgents.length || blocked) {
      return {
        strategyId: strategy.id,
        decision: "not-applicable",
        matchingFindings,
        compatibleAgents,
        risk: strategy.risk,
        reason: blocked
          ? "The installed or registered version is blocked."
          : !matchingFindings.length
            ? "No current finding matches this strategy."
            : "No detected or connected client is compatible.",
      };
    }

    if (mode === "manual") {
      return {
        strategyId: strategy.id,
        decision: strategy.enabled ? "manual" : "review",
        matchingFindings,
        compatibleAgents,
        risk: strategy.risk,
        reason: strategy.enabled
          ? "Enabled by the user for compatible findings."
          : "Available for manual selection.",
      };
    }

    if (strategy.risk === "low") {
      return {
        strategyId: strategy.id,
        decision: strategy.enabled ? "automatic" : "review",
        matchingFindings,
        compatibleAgents,
        risk: strategy.risk,
        reason: strategy.enabled
          ? "Eligible for automatic routing because it is compatible, low risk, and selected."
          : "Compatible and low risk, but excluded from automatic routing.",
      };
    }

    return {
      strategyId: strategy.id,
      decision: "review",
      matchingFindings,
      compatibleAgents,
      risk: strategy.risk,
      reason: "Compatible, but requires review because its risk is not low.",
    };
  });
}
