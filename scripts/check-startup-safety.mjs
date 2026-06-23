import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const config = JSON.parse(
  await readFile(new URL("src-tauri/tauri.conf.json", root), "utf8"),
);

const preload = config.plugins?.sql?.preload;
if (Array.isArray(preload) && preload.length > 0) {
  console.error(
    "SQL preload is disabled: database connection or migration errors must not abort macOS launch.",
  );
  process.exit(1);
}

const updater = config.plugins?.updater;
if (!updater || typeof updater !== "object" || Array.isArray(updater)) {
  console.error("Updater configuration must be a non-null object.");
  process.exit(1);
}
if (typeof updater.pubkey !== "string") {
  console.error("Updater configuration must contain a string pubkey field.");
  process.exit(1);
}
if (!Array.isArray(updater.endpoints) || updater.endpoints.length === 0) {
  console.error("Updater configuration must contain at least one endpoint.");
  process.exit(1);
}
if (updater.endpoints.some((endpoint) => typeof endpoint !== "string" || !endpoint.startsWith("https://"))) {
  console.error("Updater endpoints must use HTTPS.");
  process.exit(1);
}

console.log("Startup safety check passed: lazy SQLite and non-null updater configuration.");
