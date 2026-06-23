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

console.log("Startup safety check passed: SQLite is loaded after the window launches.");
