import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

const REGISTRY_PATH = new URL("../registry/strategies.json", import.meta.url);
const API_ROOT = "https://api.github.com";
const token = process.env.GITHUB_TOKEN?.trim();

function headers() {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "token-saver-registry-sync",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function githubJson(path) {
  const response = await fetch(`${API_ROOT}${path}`, { headers: headers() });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`GitHub ${response.status} for ${path}: ${detail.slice(0, 240)}`);
  }
  return response.json();
}

function normalizeVersion(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/^refs\/tags\//, "");
  return normalized || null;
}

async function latestRelease(repository) {
  try {
    const release = await githubJson(`/repos/${repository}/releases/latest`);
    return {
      latestVersion: normalizeVersion(release.tag_name),
      publishedAt: release.published_at ?? release.created_at ?? null,
      url: release.html_url ?? `https://github.com/${repository}/releases`,
      source: "github-release",
    };
  } catch (releaseError) {
    const tags = await githubJson(`/repos/${repository}/tags?per_page=1`);
    const tag = Array.isArray(tags) ? tags[0] : undefined;
    if (!tag?.name) throw releaseError;
    return {
      latestVersion: normalizeVersion(tag.name),
      publishedAt: null,
      url: `https://github.com/${repository}/releases/tag/${encodeURIComponent(tag.name)}`,
      source: "github-tag",
    };
  }
}

function releaseChanged(previous, next) {
  return (
    previous?.latestVersion !== next.latestVersion ||
    previous?.publishedAt !== next.publishedAt ||
    previous?.url !== next.url ||
    previous?.source !== next.source
  );
}

async function main() {
  const raw = await readFile(REGISTRY_PATH, "utf8");
  const registry = JSON.parse(raw);
  if (registry.schemaVersion !== 1 || !Array.isArray(registry.strategies)) {
    throw new Error("Unsupported or invalid strategy registry schema");
  }

  let changed = false;
  const checkedAt = new Date().toISOString();

  for (const strategy of registry.strategies) {
    try {
      const upstream = await latestRelease(strategy.repository);
      if (releaseChanged(strategy.release, upstream)) {
        strategy.release = { ...upstream, checkedAt };
        changed = true;
        console.log(`${strategy.id}: ${upstream.latestVersion ?? "unknown"}`);
      } else {
        console.log(`${strategy.id}: unchanged (${upstream.latestVersion ?? "unknown"})`);
      }
    } catch (error) {
      console.error(`${strategy.id}: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 2;
    }
  }

  if (!changed) {
    console.log("Strategy registry is already current.");
    return;
  }

  registry.generatedAt = checkedAt;
  await writeFile(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  console.log("Updated registry/strategies.json");
}

await main();
