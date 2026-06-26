import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const source = resolve("src-tauri/app-icon.svg");
const output = resolve("src-tauri/icons");

if (!existsSync(source)) {
  console.error(`Missing approved app icon source: ${source}`);
  process.exit(1);
}

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["tauri", "icon", source, "--output", output],
  { stdio: "inherit", shell: false },
);

if (result.error) {
  console.error(`Could not generate Tauri application icons: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
