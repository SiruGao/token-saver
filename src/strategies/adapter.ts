import type { AgentId, StrategyMode } from "../types";

export interface StrategyRequest {
  strategyId: string;
  agent: AgentId;
  taskId?: string;
  projectPath?: string;
  inputPath?: string;
  inputText?: string;
  contentType?: string;
  dryRun: boolean;
  options: Record<string, string | number | boolean>;
}

export interface StrategyDetection {
  installed: boolean;
  version?: string;
  executablePath?: string;
  detail?: string;
}

export interface StrategyHealth {
  healthy: boolean;
  version?: string;
  latencyMs: number;
  detail: string;
}

export interface StrategyPreview {
  supported: boolean;
  estimatedTokensBefore?: number;
  estimatedTokensAfter?: number;
  reversible: boolean;
  mutatesWorkspace: boolean;
  proposedCommand?: string[];
  warnings: string[];
}

export interface StrategyResult {
  operationId: string;
  success: boolean;
  version?: string;
  inputHash?: string;
  outputHash?: string;
  tokensBefore?: number;
  tokensAfter?: number;
  reversible: boolean;
  originalReference?: string;
  elapsedMs: number;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  provenance: string[];
}

export interface RollbackResult {
  success: boolean;
  detail: string;
}

export interface StrategyAdapter {
  readonly id: string;
  readonly mode: StrategyMode;
  readonly supportedAgents: AgentId[];
  readonly supportedInputs: string[];
  readonly reversible: boolean;
  readonly mutatesWorkspace: boolean;

  detect(): Promise<StrategyDetection>;
  healthCheck(): Promise<StrategyHealth>;
  preview(request: StrategyRequest): Promise<StrategyPreview>;
  apply(request: StrategyRequest): Promise<StrategyResult>;
  rollback?(operationId: string): Promise<RollbackResult>;
}

export class ObserveOnlyAdapter implements StrategyAdapter {
  readonly reversible = false;
  readonly mutatesWorkspace = false;

  constructor(
    readonly id: string,
    readonly mode: StrategyMode,
    readonly supportedAgents: AgentId[],
    readonly supportedInputs: string[],
  ) {}

  async detect(): Promise<StrategyDetection> {
    return { installed: false, detail: "Runtime detection is not implemented for this adapter yet." };
  }

  async healthCheck(): Promise<StrategyHealth> {
    return { healthy: false, latencyMs: 0, detail: "Observe-only adapter: execution is disabled in Desktop V1." };
  }

  async preview(): Promise<StrategyPreview> {
    return {
      supported: false,
      reversible: false,
      mutatesWorkspace: false,
      warnings: ["Desktop V1 can recommend this strategy but cannot execute it."],
    };
  }

  async apply(): Promise<StrategyResult> {
    return {
      operationId: `observe-only-${this.id}-${Date.now()}`,
      success: false,
      reversible: false,
      elapsedMs: 0,
      stderr: "Execution is disabled for observe-only adapters.",
      provenance: ["No third-party process was started."],
    };
  }
}
