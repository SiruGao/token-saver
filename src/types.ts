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
export type ViewId = "dashboard" | "doctor" | "sessions" | "integrations" | "settings";

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

export interface AppSettings {
  theme: "dark" | "light" | "system";
  localOnly: boolean;
  telemetry: boolean;
  autoScan: boolean;
  largeOutputThreshold: number;
  repeatedReadWindowMinutes: number;
}

export interface WorkspaceState {
  version: 1;
  sessions: AgentSession[];
  findings: Finding[];
  integrations: Integration[];
  settings: AppSettings;
  lastScanAt?: string;
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
