import { createId } from "../core/hash";
import type {
  AgentSession,
  Finding,
  ProofRecord,
  ProofSnapshot,
} from "../types";

function snapshot(session: AgentSession, findings: Finding[]): ProofSnapshot {
  const sessionFindings = findings.filter((finding) => finding.sessionId === session.id);
  return {
    inputTokens: session.usage.input,
    outputTokens: session.usage.output,
    cacheReadTokens: session.usage.cacheRead,
    reasoningTokens: session.usage.reasoning,
    estimatedCostUsd: session.usage.estimatedCostUsd,
    toolCalls: session.events.filter((event) => Boolean(event.tool)).length,
    repeatedReads: sessionFindings.filter((finding) => finding.type === "repeated-file-read").length,
    repeatedResults: sessionFindings.filter((finding) => finding.type === "repeated-tool-result").length,
    taskStatus: session.status,
  };
}

export function createBaselineRecord(
  session: AgentSession,
  findings: Finding[],
): ProofRecord {
  return {
    id: createId("proof", `${session.id}:baseline`),
    sessionId: session.id,
    createdAt: new Date().toISOString(),
    status: "baseline",
    before: snapshot(session, findings),
    reversible: true,
    provenance: [
      `agent:${session.agent}`,
      `source:${session.source}`,
      "usage:provider-reported-or-import-estimate",
      "operation:none",
    ],
  };
}

export function syncBaselineRecords(
  sessions: AgentSession[],
  findings: Finding[],
  existing: ProofRecord[] = [],
): ProofRecord[] {
  const baselineBySession = new Map(
    existing
      .filter((record) => record.status === "baseline")
      .map((record) => [record.sessionId, record]),
  );
  const nonBaseline = existing.filter((record) => record.status !== "baseline");
  const baselines = sessions.map((session) =>
    baselineBySession.get(session.id) ?? createBaselineRecord(session, findings),
  );
  return [...baselines, ...nonBaseline];
}
