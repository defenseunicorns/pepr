# 22. PEXEX CI/CD Efficiency

Date: 2026-04-24

## Status

Proposed

Supercedes aspects of [12. E2E Testing](./0012-e2e-testing.md) (CI execution strategy only; the test suite itself is unchanged)

## Context

[ADR 0009](./0009-e2e-testing.md) established the [Pepr Excellent Examples](https://github.com/defenseunicorns/pepr-excellent-examples) (PEXEX) as Pepr's E2E test suite. [ADR 0012](./0012-e2e-testing.md) promoted PEXEX from nightly-only to part of the PR pipeline after proving sub-10-minute runtimes via parallelization.

Since then, the suite has grown from a handful of modules to 29+ independently-tested capabilities. Each Pepr PR now triggers three full PEXEX matrix runs (unicorn, upstream, ironbank), each spawning up to 32 parallel GitHub Actions jobs. The test infrastructure itself has remained largely unchanged since its inception, leading to accumulated inefficiency:

1. **No dependency caching.** PEXEX's own `e2e.yaml` workflow runs `npm ci` from cold on every matrix job — 29+ redundant dependency resolutions per workflow invocation. The pepr-triggered variants (`pepr-excellent-examples-unicorn.yml`, `-upstream.yml`) configure `cache: "npm"` on the build step but may not be hitting effectively on the per-example matrix jobs.

2. **No selective execution.** Every PR — regardless of scope — runs all 29+ E2E modules. A one-line change in `hello-pepr-validate/` runs the same matrix as a root-level `package.json` bump.

3. **Limited failure diagnostics.** PEXEX's `e2e.yaml` uploads no artifacts on failure. The pepr-triggered variants upload only `package.json` and `package-lock.json`. Controller logs, cluster state, and Kubernetes events are lost.

4. **Opaque retries.** The `nick-fields/retry@v3` action retries up to 3 times with no signal distinguishing "passed clean" from "passed on third attempt." Flaky tests are invisible.

### What was investigated but ruled out

**Shared k3d clusters.** We investigated whether multiple PEXEX modules could share a single k3d cluster to amortize startup cost. Findings:

- `hello-pepr-finalize` and `hello-pepr-alias` share UUID `6b7cfad2-722b-47f8-99ed-f3cbf65ab5b1`, meaning their MutatingWebhookConfiguration and ValidatingWebhookConfiguration resources would conflict.
- `moduleDown()` in `_helpers/src/pepr.ts` deletes the global `peprstores.pepr.dev` CRD, which would break any co-deployed module that uses the Store.
- While namespace isolation is clean (each module uses uniquely-named namespaces) and `TestRunCfg` label-based cleanup is module-scoped, the webhook and CRD conflicts are hard blockers in the current Pepr deployment model.

Conclusion: shared clusters are architecturally blocked without upstream changes to Pepr's deployment model. Not viable as a PEXEX-only optimization.

**Build artifact caching.** Each module's `dist/` output is ~100-150KB and `pepr build` takes 5-15 seconds. The complexity of managing content-addressed cache keys for per-module build output exceeds the savings.

**Docker/k3d image pre-caching.** k3d's `rancher/k3s` base image pull is a one-time ~10s cost per job. GitHub Actions runners already cache common Docker images. Marginal benefit.


## Decision

We will make four changes to PEXEX CI, plus one verification in the pepr repo:

### 1. Enable npm dependency caching

Add `cache: "npm"` to `actions/setup-node` in PEXEX's `e2e.yaml` workflow (both the `examples-matrix` and `excellent-examples` jobs). This caches `~/.npm` keyed on `package-lock.json`. `npm ci` still enforces the lock file deterministically — caching only skips network fetches.

### 2. Implement selective test execution

For pull request events only, use `dorny/paths-filter` to detect which modules were modified. Extend `.github/workflows/matrix.js` to accept a filter list and produce a reduced matrix. Changes to `_helpers/`, root config files (`package.json`, `package-lock.json`, `eslint.config.mjs`, `eslint.tsconfig.json`, `.prettierrc`), or the workflow files themselves will bypass the filter and run the full matrix. Non-PR events (`push` to main, `merge_group`, `workflow_dispatch`) always run the full matrix.

### 3. Capture failure diagnostics

On test failure, capture `kubectl logs -n pepr-system` and `kubectl get events -A` before cluster teardown. Upload these alongside test output as GitHub Actions artifacts with short retention (3 days). This happens in both `_helpers/dev/cli.mts` (log capture) and `e2e.yaml` (artifact upload).

### 4. Surface retry attempts

Add a post-step after the `nick-fields/retry` action that emits a `::warning::` annotation when `total_attempts > 1`. This makes flaky-but-passing tests visible in the workflow summary without blocking merges.

### 5. Verify upstream caching

Audit the pepr-triggered PEXEX workflows (`pepr-excellent-examples-unicorn.yml`, `-upstream.yml`) to confirm that `cache: "npm"` with `cache-dependency-path: pepr-excellent-examples` is resolving correctly. Check cache hit rates in recent workflow run logs and correct the path if needed.


## Consequences

- **Reduced CI cost.** npm caching saves ~20-40s per matrix job. Selective execution reduces the matrix from 29 to 1-3 jobs for module-scoped PRs. Combined, this is a 50-90% reduction in runner-minutes for typical PRs.

- **Unchanged confidence for full-matrix runs.** Pushes to main, merge queue, manual dispatch, and PRs touching shared infrastructure still run all 29+ modules. No test coverage is lost.

- **Faster debugging.** Failure artifacts replace blind re-runs with targeted investigation. Combined with retry transparency, this shifts the team from "retry until green" to "diagnose and fix."

- **New maintenance surface.** The `dorny/paths-filter` configuration must be updated when modules are added or renamed. The `matrix.js` filter logic adds ~15 lines of code that must be understood by CI maintainers.

- **Dependabot PRs still run full matrix.** Grouped dependency updates (which bump `pepr` across all 32 modules) modify root `package.json` and thus trigger the full matrix. This is correct behavior — version upgrades should validate everything.
