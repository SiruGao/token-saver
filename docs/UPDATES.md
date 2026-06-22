# Token Saver Update Policy

Token Saver separates application releases from third-party strategy metadata.

## Application releases

V1 Preview checks the public GitHub Releases API and reports whether a newer Token Saver version exists.

When a newer public release is available, the application can open the exact Token Saver GitHub Release page in the operating system's default browser. The release URL is validated in both the frontend and the Rust process and must remain under:

```text
https://github.com/SiruGao/token-saver/releases/
```

V1 Preview does not download or execute installers automatically. This is intentional until all of the following are complete:

- a dedicated Tauri signing key is generated;
- the private key is stored only in GitHub Actions secrets;
- the public key is embedded in release builds;
- macOS, Windows, and Linux packages are produced from the same tag;
- update manifests and packages are signed;
- upgrade and rollback tests pass on every supported platform.

Until then, users review and install a newer build from the project's GitHub Release page.

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

V1 Preview currently implements observed release metadata and read-only RTK runtime detection. Detection is not execution approval.

## Security rules

- Product code is never updated through the strategy registry.
- Registry metadata never contains executable code.
- Automatic changes to `main` are not permitted.
- Application installation is not enabled without signature verification.
- External URLs are restricted to the Token Saver GitHub Release path.
- Strategy runtime detection uses fixed commands without a shell or user arguments.
- Strategy execution is not enabled without preview, provenance, backup, and rollback support.
