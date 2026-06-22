export type AgentId =
  | "claude-code"
  | "codex"
  | "openclaw"
  | "hermes"
  | "opencode"
  | "cursor"
  | "unknown";

export type SessionStatus = "success" | "failed" | "unknown";
export type FindingSeverity = "low" | "medium" | "high";
export type ViewId = "dashboard" | "doctor" | "strategies" | "sessions" | "integrations" | "settings";

export interface TokenUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
  estimatedCostUsd: number;
}

export interface SessionEvent {
  id: string;
  timestamp: string;
  type: string;
  role?: string;
  tool?: string;
  path?: string;
  content: string;
  estimatedTokens: number;
  contentHash: string;
}

export interface AgentSession {
  id: string;
  title: string;
  project: string;
  agent: AgentId;
  source: string;
  startedAt: string;
  durationMinutes: number;
  status: SessionStatus;
  usage: TokenUsage;
  events: SessionEvent[];
}

export type FindingType =
  | "repeated-file-read"
  | "repeated-tool-result"
  | "large-tool-output"
  | "long-instruction"
  | "prompt-prefix-drift"
  | "possible-rework";

export interface Finding {
  id: string;
  type: FindingType;
  severity: FindingSeverity;
  title: string;
  description: string;
  evidence: string;
  estimatedTokens: number;
  recommendation: string;
  sessionId?: string;
}

export interface Integration {
  id: AgentId;
  name: string;
  detected: boolean;
  connected: boolean;
  path?: string;
  detail: string;
}

export type StrategyMode = "external-cli" | "local-proxy" | "library" | "workspace-tool";
export type StrategyRisk = "low" | "medium" | "high";
export type StrategyState = "available" | "installed" | "update-available" | "disabled";
export type StrategyCompatibilityStatus = "metadata-only" | "preview" | "verified" | "blocked";

export interface CompressionStrategy {
  id: string;
  name: string;
  description: string;
  repository: string;
  license: string;
  mode: StrategyMode;
  risk: StrategyRisk;
  state: StrategyState;
  installedVersion?: string;
  latestVersion?: string;
  releaseUrl?: string;
  releasePublishedAt?: string;
  lastCheckedAt?: string;
  registryGeneratedAt?: string;
  compatibilityStatus?: StrategyCompatibilityStatus;
  verifiedVersions?: string[];
  blockedVersions?: string[];
  homepage?: string;
  installCommand?: string;
  executable?: string;
  capabilities: string[];
  compatibleAgents: AgentId[];
  recommendedFor: FindingType[];
  enabled: boolean;
  managedExternally: boolean;
}

export interface StrategyRecommendation {
  strategyId: string;
  findingType: FindingType;
  reason: string;
  confidence: "low" | "medium" | "high";
}

export interface AppUpdateStatus {
  currentVersion: string;
  latestVersion?: string;
  available: boolean;
  releaseUrl?: string;
  publishedAt?: string;
  notes?: string;
  checkedAt: string;
  source: "github-release" | "signed-updater" | "unavailable";
}

export type ProofRecordStatus =
  | "baseline"
  | "preview"
  | "applied"
  | "verified"
  | "rolled-back"
  | "failed";

export interface ProofSnapshot {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  reasoningTokens: number;
  estimatedCostUsd: number;
  toolCalls: number;
  repeatedReads: number;
  repeatedResults: number;
  taskStatus: SessionStatus;
}

export interface ProofRecord {
  id: string;
  sessionId: string;
  createdAt: string;
  status: ProofRecordStatus;
  strategyId?: string;
  strategyVersion?: string;
  before: ProofSnapshot;
  after?: ProofSnapshot;
  reversible: boolean;
  provenance: string[];
}

export interface AppSettings {
  theme: "dark" | "light" | "system";
  localOnly: boolean;
  telemetry: boolean;
  autoScan: boolean;
  autoCheckStrategyUpdates?: boolean;
  autoCheckAppUpdates?: boolean;
  largeOutputThreshold: number;
  repeatedReadWindowMinutes: number;
}

export interface WorkspaceState {
  version: 1;
  sessions: AgentSession[];
  findings: Finding[];
  integrations: Integration[];
  strategies?: CompressionStrategy[];
  proofRecords?: ProofRecord[];
  settings: AppSettings;
  lastScanAt?: string;
  lastStrategyCheckAt?: string;
  appUpdate?: AppUpdateStatus;
}

export interface NativeIntegration {
  id: AgentId;
  name: string;
  detected: boolean;
  path?: string;
  detail: string;
}

export interface NativeSessionFile {
  path: string;
  modifiedAt: string;
  content: string;
}
