import type { NativeStrategyRuntime } from "../core/tauri";
import type { CompressionStrategy } from "../types";

export function applyRuntimeDetections(
  strategies: CompressionStrategy[],
  detections: NativeStrategyRuntime[],
  checkedAt: string,
): CompressionStrategy[] {
  return strategies.map((strategy) => {
    const runtime = detections.find((item) => item.strategyId === strategy.id);
    if (!runtime) return strategy;
    return {
      ...strategy,
      runtimeDetected: runtime.detected,
      runtimeHealthy: runtime.healthy,
      runtimeVersion: runtime.version,
      runtimeCheckedAt: checkedAt,
      runtimeDetail: runtime.detail,
      installedVersion: runtime.detected
        ? runtime.version ?? strategy.installedVersion
        : undefined,
      state: runtime.healthy
        ? strategy.state === "update-available" ? "update-available" : "installed"
        : strategy.state === "installed" ? "available" : strategy.state,
    };
  });
}
