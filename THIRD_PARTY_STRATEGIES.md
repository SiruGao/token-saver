# Third-Party Strategy Registry

Token Saver is an independent, vendor-neutral project. The strategies listed below are separate open-source projects maintained by their respective authors.

Registry inclusion means only that Token Saver has a metadata profile describing a possible integration. It does not mean that the project is bundled, redistributed, endorsed, security-reviewed, or executed by Desktop V1.

## Registered strategies

| Strategy | Repository | Declared license | V1 relationship |
|---|---|---|---|
| RTK | `rtk-ai/rtk` | Apache License 2.0 | Metadata, Doctor recommendations, public release checks |
| Headroom | `headroomlabs-ai/headroom` | Apache License 2.0 | Metadata, Doctor recommendations, public release checks |
| Claw Compactor | `Niyuhang2/claw-compactor` | MIT License | Metadata, Doctor recommendations, public release checks |

## License handling

Desktop V1 does not redistribute the source or binary artifacts of these strategies. Users install third-party tools through their upstream release channels.

Future bundling or automated installation requires a separate review covering:

- license and NOTICE obligations;
- copyright and trademark attribution;
- binary redistribution rights;
- checksum or signature verification;
- transitive dependencies;
- update and rollback behavior;
- security disclosures and support boundaries.

Apache-2.0 projects may require preservation of license and NOTICE content when redistributed. MIT projects require preservation of copyright and permission notices in redistributed copies or substantial portions.

## Trademark and endorsement

Product names and project names belong to their respective owners. Token Saver uses names only to identify compatibility targets. No affiliation or endorsement is implied.

## Update semantics

Token Saver distinguishes three states:

1. **Upstream release available** — public release metadata reports a newer version.
2. **Adapter-compatible release** — the adapter compatibility range and health checks accept that version.
3. **Approved release** — the user or organization has approved the version for installation or execution.

Desktop V1 implements only upstream release visibility. It does not silently install new releases.

## Reporting corrections

Maintainers of a registered project may open an issue or pull request to correct repository identity, license information, installation guidance, compatibility metadata, or branding.
