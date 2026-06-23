import { writeFile } from "node:fs/promises";

const publicKey = process.env.TOKEN_SAVER_UPDATER_PUBLIC_KEY?.trim();
const privateKey = process.env.TAURI_SIGNING_PRIVATE_KEY?.trim();
const privateKeyPassword = process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD;

function rejectCommandText(name, value) {
  const lower = value.toLowerCase();
  if (
    lower.startsWith("cat ")
    || lower.startsWith("type ")
    || lower.startsWith("get-content ")
    || lower.includes("~/.tauri/")
  ) {
    console.error(`${name} contains a shell command instead of key file contents.`);
    process.exit(1);
  }
}

if (!publicKey) {
  console.error("TOKEN_SAVER_UPDATER_PUBLIC_KEY is missing.");
  process.exit(1);
}
if (!privateKey) {
  console.error("TAURI_SIGNING_PRIVATE_KEY is missing.");
  process.exit(1);
}
if (privateKeyPassword === undefined) {
  console.error("TAURI_SIGNING_PRIVATE_KEY_PASSWORD is missing.");
  process.exit(1);
}

rejectCommandText("TOKEN_SAVER_UPDATER_PUBLIC_KEY", publicKey);
rejectCommandText("TAURI_SIGNING_PRIVATE_KEY", privateKey);

const config = {
  bundle: {
    createUpdaterArtifacts: true,
    macOS: {
      signingIdentity: "-",
    },
  },
  plugins: {
    updater: {
      pubkey: publicKey,
      endpoints: [
        "https://github.com/SiruGao/token-saver/releases/latest/download/latest.json",
      ],
      windows: {
        installMode: "passive",
      },
    },
  },
};

await writeFile(
  new URL("../src-tauri/tauri.release.conf.json", import.meta.url),
  `${JSON.stringify(config, null, 2)}\n`,
  { mode: 0o600 },
);

console.log("Prepared updater configuration with macOS ad-hoc signing.");
