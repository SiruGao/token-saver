# Token Saver Update Policy

Token Saver separates application releases from third-party strategy metadata.

## Application releases

V1 Preview checks the public GitHub Releases API and reports whether a newer Token Saver version exists.

It does not install an update automatically. This is intentional until all of the following are complete:

- a dedicated Tauri signing key is generated;
- the private key is stored only in GitHub Actions secrets;
- the public key is embedded in release builds;
- macOS, Windows, and Linux packages are produced from the same tag;
- update manifests and packages are signed;
- upgrade and rollback tests pass on every supported platform.

Until then, users install a newer build from the project's GitHub Release page.

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
2. **Compatible** — an adapter accepts the version and passes a health check.
3. **Approved** — the user or organization permits the version.
4. **Verified** — task outcome and rework metrics remain within policy.

Only the first state is implemented in V1 Preview.

## Security rules

- Product code is never updated through the strategy registry.
- Registry metadata never contains executable code.
- Automatic changes to `main` are not permitted.
- Application installation is not enabled without signature verification.
- Strategy execution is not enabled without preview, provenance, and rollback support.
