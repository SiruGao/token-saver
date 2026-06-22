import type {
  FindingType,
  FixProposalKind,
  FixProposalRisk,
} from "../types";

export interface FixPolicy {
  kind: FixProposalKind;
  risk: FixProposalRisk;
  action: string;
  reversible: boolean;
  requiresBackup: boolean;
}

export const fixPolicies: Record<FindingType, FixPolicy> = {
  "repeated-file-read": {
    kind: "internal",
    risk: "low",
    action: "Reuse an unchanged file snapshot or request only a changed range.",
    reversible: true,
    requiresBackup: false,
  },
  "repeated-tool-result": {
    kind: "internal",
    risk: "low",
    action: "Skip exact duplicate results identified by content hash.",
    reversible: true,
    requiresBackup: false,
  },
  "large-tool-output": {
    kind: "external-strategy",
    risk: "medium",
    action: "Preview deterministic output filtering while preserving errors and exit status.",
    reversible: true,
    requiresBackup: false,
  },
  "long-instruction": {
    kind: "internal",
    risk: "medium",
    action: "Separate stable instructions from task-specific context.",
    reversible: true,
    requiresBackup: true,
  },
  "prompt-prefix-drift": {
    kind: "internal",
    risk: "low",
    action: "Normalize stable prompt blocks and move dynamic values later.",
    reversible: true,
    requiresBackup: true,
  },
  "possible-rework": {
    kind: "advice-only",
    risk: "high",
    action: "Inspect repeated calls before changing context behavior.",
    reversible: false,
    requiresBackup: false,
  },
};
