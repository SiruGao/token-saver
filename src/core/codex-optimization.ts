import { isTauriRuntime } from "./tauri";

export interface CodexReductionStats {
  reducedResults: number;
  originalChars: number;
  deliveredChars: number;
  estimatedSavedTokens: number;
  lastReducedAt?: string;
}

export interface CodexOptimizationStatus {
  enabled: boolean;
  configured: boolean;
  observedActive: boolean;
  trustReviewRequired: boolean;
  strategyId: string;
  strategyVersion: string;
  thresholdChars: number;
  matcher: string;
  reversible: boolean;
  detail: string;
  stats: CodexReductionStats;
}

async function invoke<T>(command: string): Promise<T> {
  const api = await import("@tauri-apps/api/core");
  return api.invoke<T>(command);
}

function requireDesktop(): void {
  if (!isTauriRuntime()) throw new Error("Codex output optimization requires the desktop application.");
}

export async function inspectCodexOutputOptimization(): Promise<CodexOptimizationStatus | undefined> {
  if (!isTauriRuntime()) return undefined;
  return invoke<CodexOptimizationStatus>("inspect_codex_output_optimization");
}

export async function enableCodexOutputOptimization(): Promise<CodexOptimizationStatus> {
  requireDesktop();
  return invoke<CodexOptimizationStatus>("enable_codex_output_optimization");
}

export async function disableCodexOutputOptimization(): Promise<CodexOptimizationStatus> {
  requireDesktop();
  return invoke<CodexOptimizationStatus>("disable_codex_output_optimization");
}
