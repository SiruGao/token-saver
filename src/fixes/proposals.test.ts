// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { strategyRegistry } from "../strategies/registry";
import { createFixProposal, syncFixProposals } from "./proposals";

const finding = (type, overrides = {}) => ({
  id: `finding-${type}`,
  type,
  severity: "medium",
  title: type,
  description: "Synthetic finding",
  evidence: "Synthetic evidence",
  estimatedTokens: 1000,
  recommendation: "Review the proposed action.",
  sessionId: "session-1",
  ...overrides,
});

test("large output maps to a compatible external strategy", () => {
  const proposal = createFixProposal(finding("large-tool-output"), strategyRegistry);
  assert.equal(proposal.kind, "external-strategy");
  assert.equal(proposal.strategyId, "rtk");
  assert.equal(proposal.risk, "medium");
  assert.equal(proposal.reversible, true);
});

test("possible rework remains advice-only and high risk", () => {
  const proposal = createFixProposal(finding("possible-rework"), strategyRegistry);
  assert.equal(proposal.kind, "advice-only");
  assert.equal(proposal.risk, "high");
  assert.equal(proposal.strategyId, undefined);
  assert.equal(proposal.reversible, false);
});

test("sync preserves a previously reviewed proposal", () => {
  const first = createFixProposal(finding("repeated-file-read"), strategyRegistry);
  const approved = { ...first, status: "approved" };
  const synced = syncFixProposals([finding("repeated-file-read")], strategyRegistry, [approved]);
  assert.equal(synced[0], approved);
});
