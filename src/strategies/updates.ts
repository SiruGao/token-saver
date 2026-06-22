import type {
  AgentId,
  CompressionStrategy,
  FindingType,
  StrategyCompatibilityStatus,
  StrategyMode,
  StrategyRisk,
} from "../types";

const REGISTRY_URL =
  "https://raw.githubusercontent.com/SiruGao/token-saver/main/registry/strategies.json";
const API_ROOT = "https://api.github.com";
const FETCH_TIMEOUT_MS = 8_000;

interface RemoteRelease {
  latestVersion: string | null;
  publishedAt: string | null;
  url: string | null;
  checkedAt: string | null;
  source: string;
}

interface RemoteCompatibility {
  status: StrategyCompatibilityStatus;
  adapterVersion: string | null;
  verifiedVersions: string[];
  blockedVersions: string[];
}

interface RemoteStrategy {
  id: string;
  name: string;
  description: string;
  repository: string;
  homepage?: string;
  license: string;
  mode: StrategyMode;
  risk: StrategyRisk;
  installCommand?: string;
  executable?: string;
  capabilities: string[];
  compatibleAgents: AgentId[];
  recommendedFor: FindingType[];
  release: RemoteRelease;
  compatibility: RemoteCompatibility;
}

interface RemoteRegistry {
  schemaVersion: number;
  channel: string;
  generatedAt: string;
  source: string;
  strategies: RemoteStrategy[];
}

interface GitHubRelease {
  tag_name?: string;
  html_url?: string;
  published_at?: string;
}

interface GitHubTag {
  name?: string;
}

function normalizeVersion(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().replace(/^refs\/tags\//, "");
  return normalized || undefined;
}

function versionChanged(installed: string | undefined, latest: string | undefined): boolean {
  if (!installed || !latest) return false;
  return installed.replace(/^v/, "") !== latest.replace(/^v/, "");
}

function request(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, {
    cache: "no-store",
    signal: controller.signal,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  }).finally(() => window.clearTimeout(timeout));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validRemoteStrategy(strategy: RemoteStrategy): boolean {
  return (
    typeof strategy.id === "string" &&
    /^[a-z0-9][a-z0-9-]{1,62}$/.test(strategy.id) &&
    typeof strategy.repository === "string" &&
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(strategy.repository) &&
    ["external-cli", "local-proxy", "library", "workspace-tool"].includes(strategy.mode) &&
    ["low", "medium", "high"].includes(strategy.risk) &&
    isStringArray(strategy.capabilities) &&
    isStringArray(strategy.compatibleAgents) &&
    isStringArray(strategy.recommendedFor) &&
    strategy.compatibility !== undefined
  );
}

function toCompressionStrategy(
  remote: RemoteStrategy,
  previous: CompressionStrategy | undefined,
  generatedAt: string,
): CompressionStrategy {
  const latestVersion = normalizeVersion(remote.release.latestVersion);
  const installedVersion = previous?.installedVersion;
  const upstreamState = versionChanged(installedVersion, latestVersion)
    ? "update-available"
    : installedVersion
      ? "installed"
      : previous?.state === "disabled"
        ? "disabled"
        : "available";

  return {
    id: remote.id,
    name: remote.name,
    description: remote.description,
    repository: remote.repository,
    homepage: remote.homepage ?? `https://github.com/${remote.repository}`,
    license: remote.license,
    mode: remote.mode,
    risk: remote.risk,
    state: upstreamState,
    installedVersion,
    latestVersion,
    releaseUrl: remote.release.url ?? undefined,
    releasePublishedAt: remote.release.publishedAt ?? undefined,
    lastCheckedAt: remote.release.checkedAt ?? generatedAt,
    registryGeneratedAt: generatedAt,
    compatibilityStatus: remote.compatibility.status,
    verifiedVersions: remote.compatibility.verifiedVersions,
    blockedVersions: remote.compatibility.blockedVersions,
    installCommand: remote.installCommand,
    executable: remote.executable,
    capabilities: remote.capabilities,
    compatibleAgents: remote.compatibleAgents,
    recommendedFor: remote.recommendedFor,
    enabled: previous?.enabled ?? false,
    managedExternally: true,
  };
}

async function remoteRegistry(): Promise<RemoteRegistry> {
  const response = await request(REGISTRY_URL);
  if (!response.ok) throw new Error(`Registry request failed with ${response.status}`);
  const registry = (await response.json()) as RemoteRegistry;
  if (
    registry.schemaVersion !== 1 ||
    registry.channel !== "stable" ||
    registry.source !== "SiruGao/token-saver" ||
    !Array.isArray(registry.strategies) ||
    !registry.strategies.every(validRemoteStrategy)
  ) {
    throw new Error("Remote strategy registry failed validation");
  }
  return registry;
}

async function directLatestVersion(repository: string): Promise<{
  latestVersion?: string;
  releaseUrl?: string;
  releasePublishedAt?: string;
}> {
  const releaseResponse = await request(`${API_ROOT}/repos/${repository}/releases/latest`);
  if (releaseResponse.ok) {
    const release = (await releaseResponse.json()) as GitHubRelease;
    return {
      latestVersion: normalizeVersion(release.tag_name),
      releaseUrl: release.html_url,
      releasePublishedAt: release.published_at,
    };
  }

  const tagsResponse = await request(`${API_ROOT}/repos/${repository}/tags?per_page=1`);
  if (!tagsResponse.ok) return {};
  const tags = (await tagsResponse.json()) as GitHubTag[];
  const tag = tags[0]?.name;
  return {
    latestVersion: normalizeVersion(tag),
    releaseUrl: tag
      ? `https://github.com/${repository}/releases/tag/${encodeURIComponent(tag)}`
      : undefined,
  };
}

async function directFallback(
  strategies: CompressionStrategy[],
): Promise<CompressionStrategy[]> {
  const checkedAt = new Date().toISOString();
  return Promise.all(
    strategies.map(async (strategy) => {
      try {
        const release = await directLatestVersion(strategy.repository);
        return {
          ...strategy,
          ...release,
          lastCheckedAt: checkedAt,
          state: versionChanged(strategy.installedVersion, release.latestVersion)
            ? "update-available"
            : strategy.installedVersion
              ? "installed"
              : strategy.state,
        };
      } catch {
        return { ...strategy, lastCheckedAt: checkedAt };
      }
    }),
  );
}

export async function checkStrategyUpdates(
  strategies: CompressionStrategy[],
): Promise<CompressionStrategy[]> {
  try {
    const registry = await remoteRegistry();
    const previousById = new Map(strategies.map((strategy) => [strategy.id, strategy]));
    const remoteStrategies = registry.strategies.map((strategy) =>
      toCompressionStrategy(strategy, previousById.get(strategy.id), registry.generatedAt),
    );
    const remoteIds = new Set(remoteStrategies.map((strategy) => strategy.id));
    const localOnly = strategies.filter((strategy) => !remoteIds.has(strategy.id));
    return [...remoteStrategies, ...localOnly];
  } catch {
    return directFallback(strategies);
  }
}
