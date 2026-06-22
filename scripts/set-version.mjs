import { readFile, writeFile } from "node:fs/promises";

const version = process.argv[2]?.trim();
if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("Usage: npm run release:version -- 1.1.0");
  process.exit(1);
}

const root = new URL("../", import.meta.url);
const packageUrl = new URL("package.json", root);
const lockUrl = new URL("package-lock.json", root);
const tauriUrl = new URL("src-tauri/tauri.conf.json", root);
const cargoUrl = new URL("src-tauri/Cargo.toml", root);

const packageJson = JSON.parse(await readFile(packageUrl, "utf8"));
packageJson.version = version;
await writeFile(packageUrl, `${JSON.stringify(packageJson, null, 2)}\n`);

try {
  const packageLock = JSON.parse(await readFile(lockUrl, "utf8"));
  packageLock.version = version;
  if (packageLock.packages?.[""]) packageLock.packages[""].version = version;
  await writeFile(lockUrl, `${JSON.stringify(packageLock, null, 2)}\n`);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const tauriConfig = JSON.parse(await readFile(tauriUrl, "utf8"));
tauriConfig.version = version;
await writeFile(tauriUrl, `${JSON.stringify(tauriConfig, null, 2)}\n`);

const cargoToml = await readFile(cargoUrl, "utf8");
const updatedCargo = cargoToml.replace(
  /(^\[package\][\s\S]*?^version\s*=\s*")[^"]+("\s*$)/m,
  `$1${version}$2`,
);
if (updatedCargo === cargoToml) throw new Error("Could not update Cargo package version");
await writeFile(cargoUrl, updatedCargo);

console.log(`Updated Token Saver release version to ${version}.`);
