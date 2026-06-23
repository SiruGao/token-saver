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
export type ViewId = "dashboard" | "doctor" | "strategies" | "proof" | "sessions" | "integrations" | "settings";
export type OptimizationMode = "automatic" | "manual";

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

export type ConnectorDataQuality = "official-usage" | "measured-events" | "estimated-only";

export interface ConnectorStatus {
  id: AgentId;
  detected: boolean;
  authorized: boolean;
  captureEnabled: boolean;
  mode: string;
  dataQuality: ConnectorDataQuality;
  permissionSummary: string;
  pendingEvents: number;
  lastEventAt?: string;
  lastError?: string;
  detail: string;
  syncing?: boolean;
  lastSyncedAt?: string;
  importedSessions?: number;
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
  runtimeDetected?: boolean;
  runtimeHealthy?: boolean;
  runtimeVersion?: string;
  runtimeCheckedAt?: string;
  runtimeDetail?: string;
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

export interface RtkGainSummary {
  totalCommands: number;
  totalInput: number;
  totalOutput: number;
  totalSaved: number;
  avgSavingsPct: number;
}

export interface RtkAdapterStatus {
  installed: boolean;
  correctBinary: boolean;
  configured: boolean;
  version?: string;
  executablePath?: string;
  claudeCodeDetected: boolean;
  canInstall: boolean;
  canEnable: boolean;
  canDisable: boolean;
  detail: string;
  setupDetail: string;
  gain?: RtkGainSummary;
  checkedAt?: string;
  busy?: boolean;
  error?: string;
}

export interface RtkSetupPreview {
  title: string;
  description: string;
  changes: string[];
  reversible: boolean;
  requiresRestart: boolean;
  source: string;
}

export interface IsolationStats {
  isolatedResults: number;
  originalChars: number;
  deliveredChars: number;
  estimatedSavedTokens: number;
  lastIsolatedAt?: string;
}

export interface ToolResultIsolationStatus {
  enabled: boolean;
  configured: boolean;
  strategyId: string;
  strategyVersion: string;
  thresholdChars: number;
  matcher: string;
  reversible: boolean;
  detail: string;
  stats: IsolationStats;
  busy?: boolean;
  error?: string;
  checkedAt?: string;
}

export interface AppUpdateStatus {
  configured?: boolean;
  currentVersion: string;
  latestVersion?: string;
  available: boolean;
  installing?: boolean;
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

export interface ProofStorageStatus {
  mode: "sqlite" | "web-preview" | "fallback" | "initializing";
  detail: string;
  ready: boolean;
}

export type FixProposalKind = "internal" | "external-strategy" | "advice-only";
export type FixProposalRisk = "low" | "medium" | "high";
export type FixProposalStatus = "proposed" | "approved" | "previewed" | "applied" | "rejected";

export interface FixProposal {
  id: string;
  findingId: string;
  sessionId?: string;
  title: string;
  kind: FixProposalKind;
  risk: FixProposalRisk;
  status: FixProposalStatus;
  action: string;
  strategyId?: string;
  reversible: boolean;
  requiresBackup: boolean;
  rationale: string;
}

export interface AppSettings {
  theme: "dark" | "light" | "system";
  localOnly: boolean;
  telemetry: boolean;
  autoScan: boolean;
  autoSyncConnectors?: boolean;
  optimizationMode?: OptimizationMode;
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
  connectorStatuses?: ConnectorStatus[];
  strategies?: CompressionStrategy[];
  proofRecords?: ProofRecord[];
  proofStorage?: ProofStorageStatus;
  fixProposals?: FixProposal[];
  rtkAdapter?: RtkAdapterStatus;
  toolResultIsolation?: ToolResultIsolationStatus;
  settings: AppSettings;
  lastScanAt?: string;
  lastConnectorSyncAt?: string;
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

export interface NativeHookEventFile {
  path: string;
  modifiedAt: string;
  content: string;
}
