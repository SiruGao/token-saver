import type { CompressionStrategy } from "../types";

interface GitHubRelease {
  tag_name?: string;
  html_url?: string;
  published_at?: string;
}

interface GitHubTag {
  name?: string;
}

function normalizeVersion(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.trim().replace(/^refs\/tags\//, "");
}

async function latestVersion(repository: string): Promise<string | undefined> {
  const headers = { Accept: "application/vnd.github+json" };
  const releaseResponse = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, { headers });
  if (releaseResponse.ok) {
    const release = (await releaseResponse.json()) as GitHubRelease;
    return normalizeVersion(release.tag_name);
  }

  const tagsResponse = await fetch(`https://api.github.com/repos/${repository}/tags?per_page=1`, { headers });
  if (!tagsResponse.ok) return undefined;
  const tags = (await tagsResponse.json()) as GitHubTag[];
  return normalizeVersion(tags[0]?.name);
}

function versionChanged(installed: string | undefined, latest: string | undefined): boolean {
  if (!installed || !latest) return false;
  return installed.replace(/^v/, "") !== latest.replace(/^v/, "");
}

export async function checkStrategyUpdates(
  strategies: CompressionStrategy[],
): Promise<CompressionStrategy[]> {
  const checkedAt = new Date().toISOString();
  return Promise.all(
    strategies.map(async (strategy) => {
      try {
        const latest = await latestVersion(strategy.repository);
        return {
          ...strategy,
          latestVersion: latest ?? strategy.latestVersion,
          lastCheckedAt: checkedAt,
          state: versionChanged(strategy.installedVersion, latest)
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
