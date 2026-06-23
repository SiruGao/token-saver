import { writeFile } from "node:fs/promises";

const publicKey = process.env.TOKEN_SAVER_UPDATER_PUBLIC_KEY?.trim();
const privateKey = process.env.TAURI_SIGNING_PRIVATE_KEY?.trim();
const privateKeyPassword = process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD;

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

const config = {
  bundle: {
    createUpdaterArtifacts: true,
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

console.log("Prepared signed updater release configuration.");
