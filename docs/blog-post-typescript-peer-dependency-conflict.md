# The Version That Refused to Rest

On June 11, 2024, the Pepr team accidentally published version `0.0.0-development` to npm.
After realizing our mistake, we marked the package as deprecated, kept the quirk committed to organizational knowledge, and moved on.
Twenty months later, that single publish continues to impact our development workflow.
We believe in getting knowledge out of individual heads and into shared spaces, so this post documents the technical details and lessons learned for the benefit of our team and contributors to Pepr.

## The Problem: `pepr init` Won't Complete

When working on Pepr locally, we build a fresh tarball and run `npx --yes pepr@file://./pepr-0.0.0-development.tgz init`.
The CLI scaffolds the module, but then the initialization fails:

```
npm error code ERESOLVE
npm error ERESOLVE unable to resolve dependency tree
npm error
npm error While resolving: new-pepr-module@0.0.1
npm error Found: typescript@5.8.3
npm error node_modules/typescript
npm error   dev typescript@"5.8.3" from the root project
npm error
npm error Could not resolve dependency:
npm error peer typescript@"5.3.3" from pepr@0.0.0-development
npm error node_modules/pepr
npm error   pepr@"0.0.0-development" from the root project
```

The error reveals a version mismatch: our codebase uses TypeScript 5.8.3, but npm is complaining about 5.3.3 from `pepr@0.0.0-development`.
npm resolves `"pepr": "0.0.0-development"` by querying the registry, not the local tarball we used for initialization.
It finds the June 2024 publish with outdated peer dependencies (`typescript@5.3.3`), conflicting with our current version (`5.8.3`).

## Following the Breadcrumbs

### The Build Process: Embedding Metadata

When we run `npm run build`, the build pipeline executes three steps:

1. `npm run gen-data-json` executes [`hack/build-template-data.mjs`](https://github.com/defenseunicorns/pepr/tree/main/hack/build-template-data.mjs), reading [`package.json`](https://github.com/defenseunicorns/pepr/tree/main/package.json) (including `version: "0.0.0-development"`) and writing to `src/templates/data.json`
2. TypeScript compilation preserves `data.json` imports
3. esbuild inlines `data.json` contents into the bundle

Every CLI invocation carries a complete snapshot of package metadata from build time, ensuring `pepr init` generates modules compatible with the Pepr version being used.

### Module Initialization: Extracting the Snapshot

When running `pepr init`, the CLI [extracts this embedded data](https://github.com/defenseunicorns/pepr/tree/main/src/cli/init/templates.ts#L21):

```typescript
export const { dependencies, devDependencies, peerDependencies, scripts, version } = packageJSON;
```

It then constructs a `package.json` for your new module:

```typescript
const { typescript } = peerDependencies;  // "5.8.3" from current codebase

const data = {
  dependencies: {
    pepr: version,  // "0.0.0-development" - the embedded version
    undici: "^7.0.1",
  },
  devDependencies: {
    typescript,  // "5.8.3" - current version
  },
};
```

Here's where things get tricky: we're using the **current** TypeScript version (5.8.3) but referencing the **development** version string for Pepr itself.

### The Conflict: When npm Queries the Registry

After generating files, `pepr init` runs `npm install`.
npm queries the registry for `pepr@0.0.0-development`, finds our [June 2024 publish with `typescript@5.3.3` peer dependency](https://github.com/defenseunicorns/pepr/blob/cd233635/package.json#L67), and detects a conflict with the installed `typescript@5.8.3`.

## The Version Resolution Trap

The root cause is a chain of events: `package.json` contains `version: "0.0.0-development"`, which the build embeds into the CLI. When `pepr init` generates a new module, it uses this embedded version string. Then `npm install` resolves that version from the registry, finds the old June 2024 publish with outdated peer dependencies, and triggers the conflict.

We're testing with a local tarball, but the generated module references the version string, which npm resolves from the registry, not the local file.

You can verify this version still exists in the registry:

```bash
npm view pepr time --show-deprecated | grep development
  '0.0.0-development': '2024-06-11T18:37:04.321Z',
```

This confirms the June 11, 2024 publish is still present in the registry, even though it's deprecated. When npm resolves `"pepr": "0.0.0-development"`, it finds this exact version with its outdated peer dependencies.

The generated module contains `"pepr": "0.0.0-development"` as an [exact version string](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#dependencies). npm queries the registry for this exact version, completely bypassing the local tarball we used to run `pepr init`. This is why the old peer dependencies from June 2024 come into play.

## Why This Only Affects Development

This issue **only impacts local development**.
Production users install released versions with proper version numbers and up-to-date peer dependencies.
Only the local development workflow (building locally, testing `pepr init`, running integration tests) encounters this problem.

## Workarounds We've Explored

We manually add package overrides to `src/templates/data.json` after it's generated during the build:

```json
{
  "overrides": {
    "pepr": "file://../pepr-0.0.0-development.tgz"
  }
}
```

This tells npm to use the local tarball instead of querying the registry, but requires maintaining correct relative paths during local iteration.

We considered using `--legacy-peer-deps` to ignore the conflicts, but rejected this approach. Adding that flag to our CI pipeline would paper over peer dependency issues across the entire project, reducing our ability to catch legitimate dependency conflicts. The manual override in `data.json` keeps the workaround scoped to local development without compromising project quality standards in CI.

Other alternatives we dismissed: changing the version string to something not in the registry (doesn't address the root cause), or manually running `npm install --legacy-peer-deps` after init.

## The Path Forward

The most robust solution: **remove the version field from source control and clean up the registry**.

1. Remove `"version": "0.0.0-development"` from [`package.json`](https://github.com/defenseunicorns/pepr/tree/main/package.json) and inject it during release via CI/CD workflows
2. Contact npm support to unpublish `pepr@0.0.0-development`

By omitting it from source control and injecting during release, we eliminate development version string conflicts while removing the problematic registry entry.

## Lessons Learned

This incident taught us several valuable lessons about npm's dependency resolution:

- **Development versions published to npm registries are permanent**: Deprecation doesn't remove them from resolution. Once `0.0.0-development` hit the registry, it became a permanent fixture affecting all future local builds.
- **Build-time snapshots create temporal coupling**: Embedding `package.json` metadata into CLI artifacts means every build carries outdated version strings that persist until the next build, creating drift between source and runtime.
- **npm resolves exact versions from the registry, not from install source**: Installing via `pepr@file://./local.tgz` doesn't prevent npm from querying the registry when resolving `"pepr": "0.0.0-development"` in generated package files.
- **Peer dependency conflicts block installation entirely**: Unlike regular dependencies where npm can attempt resolution strategies, peer dependency mismatches are fatal errors that prevent any workaround short of `--legacy-peer-deps`.

A single accidental publish created ripples lasting months, reminding us that development tools are complex systems with subtle interdependencies.
While this issue only affects our development workflow, documenting it may help others encountering similar peer dependency mysteries.

You can track our progress on resolving this issue at [defenseunicorns/pepr#2943](https://github.com/defenseunicorns/pepr/issues/2943).

---

*For the technically curious, here are the key files involved in this flow:*

- [`package.json`](https://github.com/defenseunicorns/pepr/tree/main/package.json) - Contains the hardcoded development version
- [`hack/build-template-data.mjs`](https://github.com/defenseunicorns/pepr/tree/main/hack/build-template-data.mjs) - Embeds package.json into the build
- `src/templates/data.json` - The embedded package metadata (generated)
- [`src/cli/init/templates.ts`](https://github.com/defenseunicorns/pepr/tree/main/src/cli/init/templates.ts) - Generates new module package.json
- [`src/cli/init/doPostInitActions.ts`](https://github.com/defenseunicorns/pepr/tree/main/src/cli/init/doPostInitActions.ts) - Runs the failing npm install
