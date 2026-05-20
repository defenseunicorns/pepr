# 22. Migrate from semantic-release to release-please

Date: 2026-05-19

## Status

Accepted (supersedes [11. semantic-release](./0011-semantic-release.md))

## Context

As described in [10. Automated Releases](./0010-automated-releases.md) and [11. semantic-release](./0011-semantic-release.md), Pepr uses semantic-release to automate versioning and publishing. Every push to `main` with conventional commits immediately triggers a version bump, git tag, GitHub Release, and npm publish.

While this "release on every merge" model reduces toil, it has drawbacks:

- **No human gate before release.** A merged `fix:` commit immediately cuts a release with no opportunity for review, batching, or timing control.
- **No release preview.** There is no way to see what the next release will contain or what version it will be before it happens.
- **Difficult to coordinate releases.** When multiple changes land in quick succession, each triggers a separate release rather than batching into one.
- **Limited changelog control.** semantic-release generates release notes at publish time with no opportunity to review or edit them beforehand.

[release-please](https://github.com/googleapis/release-please) addresses these by introducing a **release PR gate**: pushes to `main` create or update a release PR (with changelog and version bump), and only merging that PR triggers the actual release. This is the same pattern used by the [UDS Registry](https://github.com/defenseunicorns/uds-registry) project.

## Decision

We will replace semantic-release with release-please (v5, via `googleapis/release-please-action`) as the release automation tool for Pepr.

### Key design choices

**`release-type: simple`** — The `node` release type would update `package.json` in the release PR, but Pepr's CI workflows, tests, and scripts depend on `package.json` having `version: "0.0.0-development"` at build time. The `simple` type avoids this by only updating `CHANGELOG.md` and `.release-please-manifest.json`. The real version is stamped into `package.json` at release time via `scripts/set-version.js` in each downstream job.

**Manifest as version source of truth** — `.release-please-manifest.json` tracks the current released version. release-please reads it to compute the next version bump based on conventional commits since the last release.

**Conventional commits still drive semver** — `fix:` → patch, `feat:` → minor, `feat!:` / `BREAKING CHANGE` → major. No change to developer workflow.

### Alternatives considered

**Keep semantic-release with a staging branch** — Would add a pre-release flow but increases branch management complexity without the changelog preview benefits of release-please.

**`release-type: node`** — Would auto-update `package.json` version, but breaks ~20+ files across CI, tests, and scripts that reference `pepr-0.0.0-development.tgz`. The cost of updating all consumers outweighs the benefit.

## Consequences

- The `@semantic-release/*` devDependencies are removed from `package.json`.
- Two new config files are added: `release-please-config.json` and `.release-please-manifest.json`.
- The release workflow (`.github/workflows/release.yml`) is restructured into: `tag-new-version` → `slsa` → `publish` → `build-and-publish-images` / `pack-and-push`.
- Merging to `main` no longer immediately releases. Instead, release-please creates/updates a release PR. Merging that PR triggers the release.
- `package.json` remains at `0.0.0-development` in the repository. The published npm package and container images receive the real version at build time via `set-version.js`.
- The SLSA 3 compliance workflow is preserved. The SLSA builder resolves the version via `git fetch --tags && git describe --tags` in the `npm run set-version` script.
- The workflow name `"Version Release"` is preserved to maintain the `workflow_run` trigger coupling with `docs.yml`.
