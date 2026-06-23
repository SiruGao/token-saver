# Token Saver Update Policy

Token Saver separates application releases from third-party strategy metadata.

## Signed application updates

Desktop releases use the official Tauri updater. A signed build can:

1. check the GitHub Release `latest.json` manifest;
2. download the platform-specific updater artifact;
3. verify its mandatory Tauri signature;
4. install the update;
5. restart Token Saver.

The updater endpoint is:

```text
https://github.com/SiruGao/token-saver/releases/latest/download/latest.json
```

The updater configuration must always be a non-null object. Missing signing configuration must never prevent the application window from opening. Local or unsigned development builds fall back to the trusted GitHub Release page.

## One-time signing key setup

The Tauri updater requires a dedicated key pair. Signature verification cannot be disabled.

Generate it locally from the repository root:

```bash
mkdir -p ~/.tauri
npm run tauri signer generate -- -w ~/.tauri/token-saver.key
```

Choose and retain the private-key password. Never send or commit the private key.

The command creates:

```text
~/.tauri/token-saver.key
~/.tauri/token-saver.key.pub
```

Add these GitHub Actions secrets in repository settings:

```text
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
TOKEN_SAVER_UPDATER_PUBLIC_KEY
```

Secret values:

- `TAURI_SIGNING_PRIVATE_KEY`: the complete contents of `~/.tauri/token-saver.key`;
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: the password chosen during generation;
- `TOKEN_SAVER_UPDATER_PUBLIC_KEY`: the complete contents of `~/.tauri/token-saver.key.pub`.

The public key is embedded at compile time. The private key exists only in GitHub Actions secrets and signs release artifacts.

## Release flow

Application versions in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` must remain synchronized.

Set a new version:

```bash
npm run release:version -- 1.0.1
npm run check
```

Commit the version change, then create and push the matching tag:

```bash
git tag v1.0.1
git push origin v1.0.1
```

The `Release signed desktop updates` workflow builds macOS, Windows, and Linux artifacts and uploads:

- normal installers;
- updater bundles;
- `.sig` signature files;
- `latest.json`.

The first working signed release is a one-time manual bootstrap installation. Every later version can be installed from Token Saver Settings.

## Strategy metadata

`registry/strategies.json` is the reviewed baseline registry. It contains metadata only:

- upstream repository identity;
- declared license;
- integration mode and risk;
- supported agents and capabilities;
- latest observed upstream release;
- compatibility status;
- verified and blocked versions.

The desktop client validates the registry schema and repository names before merging remote metadata into the local workspace. If the reviewed registry is unavailable, it may query public upstream GitHub release metadata directly.

A newer upstream release means only **release available**. It does not mean **compatible**, **approved**, or **safe to execute**.

## Updating the reviewed registry

Run:

```bash
npm run registry:sync
```

Then review the resulting diff in `registry/strategies.json` and submit it through a pull request. The synchronization script never installs or executes third-party software.

## Required states

Token Saver distinguishes these states:

1. **Observed** — an upstream release exists.
2. **Detected** — a local runtime responds to a fixed read-only version command.
3. **Compatible** — an adapter accepts the version and passes a health check.
4. **Approved** — the user or organization permits the version.
5. **Verified** — task outcome and rework metrics remain within policy.

## Security rules

- Updater artifacts are never installed without signature verification.
- The updater private key is never committed or sent through the application.
- Product code is never updated through the strategy registry.
- Registry metadata never contains executable code.
- External fallback URLs are restricted to the Token Saver GitHub Release path.
- Strategy runtime detection uses fixed commands without a shell or user arguments.
- Strategy execution is not enabled without preview, provenance, backup, and rollback support.
