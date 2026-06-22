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
  lastCheckedAt?: string;
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

export interface AppSettings {
  theme: "dark" | "light" | "system";
  localOnly: boolean;
  telemetry: boolean;
  autoScan: boolean;
  autoCheckStrategyUpdates: boolean;
  largeOutputThreshold: number;
  repeatedReadWindowMinutes: number;
}

export interface WorkspaceState {
  version: 1;
  sessions: AgentSession[];
  findings: Finding[];
  integrations: Integration[];
  strategies: CompressionStrategy[];
  settings: AppSettings;
  lastScanAt?: string;
  lastStrategyCheckAt?: string;
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
