import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const tauriConfig = JSON.parse(await readFile(new URL("src-tauri/tauri.conf.json", root), "utf8"));
const cargoToml = await readFile(new URL("src-tauri/Cargo.toml", root), "utf8");
const cargoVersion = cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1];

const versions = {
  package: packageJson.version,
  tauri: tauriConfig.version,
  cargo: cargoVersion,
};

const unique = new Set(Object.values(versions));
if (unique.size !== 1 || [...unique].some((value) => typeof value !== "string" || !value)) {
  console.error("Application versions are not synchronized:");
  for (const [name, value] of Object.entries(versions)) {
    console.error(`- ${name}: ${value ?? "missing"}`);
  }
  process.exit(1);
}

console.log(`Application version is synchronized at ${packageJson.version}.`);
