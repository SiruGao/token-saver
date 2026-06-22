import { createId } from "../core/hash";
import { recommendationsForFindings } from "../strategies/registry";
import type {
  CompressionStrategy,
  Finding,
  FixProposal,
} from "../types";
import { fixPolicies } from "./policies";

function recommendedStrategy(
  finding: Finding,
  strategies: CompressionStrategy[],
): string | undefined {
  return recommendationsForFindings([finding], strategies)[0]?.strategyId;
}

export function createFixProposal(
  finding: Finding,
  strategies: CompressionStrategy[],
): FixProposal {
  const policy = fixPolicies[finding.type];
  const strategyId = policy.kind === "external-strategy"
    ? recommendedStrategy(finding, strategies)
    : undefined;
  return {
    id: createId("fix", finding.id),
    findingId: finding.id,
    sessionId: finding.sessionId,
    title: finding.title,
    kind: strategyId ? "external-strategy" : policy.kind === "external-strategy" ? "advice-only" : policy.kind,
    risk: policy.risk,
    status: "proposed",
    action: policy.action,
    strategyId,
    reversible: policy.reversible,
    requiresBackup: policy.requiresBackup,
    rationale: finding.evidence,
  };
}

export function syncFixProposals(
  findings: Finding[],
  strategies: CompressionStrategy[],
  existing: FixProposal[] = [],
): FixProposal[] {
  const previous = new Map(existing.map((proposal) => [proposal.findingId, proposal]));
  return findings.map((finding) =>
    previous.get(finding.id) ?? createFixProposal(finding, strategies),
  );
}
