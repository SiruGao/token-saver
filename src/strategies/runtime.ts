import type { NativeStrategyRuntime } from "../core/tauri";
import type { CompressionStrategy, StrategyState } from "../types";

function runtimeState(
  strategy: CompressionStrategy,
  healthy: boolean,
): StrategyState {
  if (healthy) {
    return strategy.state === "update-available" ? "update-available" : "installed";
  }
  return strategy.state === "installed" ? "available" : strategy.state;
}

export function applyRuntimeDetections(
  strategies: CompressionStrategy[],
  detections: NativeStrategyRuntime[],
  checkedAt: string,
): CompressionStrategy[] {
  return strategies.map((strategy): CompressionStrategy => {
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
      state: runtimeState(strategy, runtime.healthy),
    };
  });
}
