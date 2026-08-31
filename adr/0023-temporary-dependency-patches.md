# 23. Temporary Dependency Patches

Date: 2026-08-31

## Status

Accepted

## Context

Pepr keeps dependencies current through Dependabot and scheduled peer dependency update workflows. Sometimes an upstream package has a small bug that blocks an otherwise valid dependency update, but the upstream fix is not merged or released yet.

The motivating case is `thread-stream`, a transitive dependency of `pino`. `@types/node@26` removed the deprecated `worker_threads.TransferListItem` alias, while `thread-stream@4.2.0` still referenced it in `index.d.ts`. That caused TypeScript to fail with:

```text
error TS2694: Namespace '"worker_threads"' has no exported member 'TransferListItem'.
```

Upstream issue pinojs/thread-stream#228 and PR pinojs/thread-stream#233 identify the fix: replace `workerThreads.TransferListItem[]` with `workerThreads.Transferable[]`. At the time of this decision, that fix was not available in a released package version.

We need a standard way to unblock dependency updates without weakening compiler checks, pinning unrelated dependency versions indefinitely, or maintaining forks for small temporary fixes. We also need the workaround to preserve Pepr's package boundary: a freshly generated module should keep building after installing a published or packed Pepr package, without requiring module authors to know about Pepr's repo-local patch state.

## Compatibility Goals

- Updating Pepr's dependencies should remain non-breaking for module authors when the generated module template has not otherwise changed in a breaking way.
- Pepr can adopt `@types/node@26` while carrying a temporary upstream workaround, but generated modules must still build with the dependency versions Pepr emits.
- Module authors should not need to add their own `patch-package` setup for a transitive dependency bug introduced by Pepr's dependency graph.
- CI must verify the published-package path, not only the source-checkout path. A compatibility test should install the packed Pepr tarball into a freshly generated module and run `pepr build` without reaching back to repo-local patch files.
- Temporary patch removal should have a clear cue. For this case, remove the workaround when Pepr bumps `pino` to a version that resolves the fixed `thread-stream` declaration transitively.

## Decision

We will use [`patch-package`](https://www.npmjs.com/package/patch-package) for small, temporary dependency patches when all of the following are true:

- The upstream package blocks a dependency update or CI verification.
- The local patch is narrow, reviewable, and low-risk.
- There is an upstream issue, PR, release note, or other clear removal condition.
- We can verify the patched dependency through normal CI.

For npm installs, `package.json` will run `patch-package` from `postinstall` so committed patches are applied after `npm ci`. Patch files will be committed under `patches/` and included in Pepr's published package when needed to keep generated modules buildable for module authors.

For the `thread-stream` case, the local patch applies the same one-line declaration change proposed upstream:

```diff
-  emit(eventName: 'message', message: any, transferList?: workerThreads.TransferListItem[]): boolean
+  emit(eventName: 'message', message: any, transferList?: workerThreads.Transferable[]): boolean
```

We will not use this mechanism for broad rewrites, behavior changes that require ownership, security fixes that need deeper review, or changes that should be carried as a maintained fork.

When a patch must apply in downstream generated modules, `patch-package` is a production dependency of Pepr for the lifetime of the workaround. Pepr's `postinstall` wrapper should run from the installing project root when Pepr is installed as a dependency, so the patch mutates the generated module's `node_modules`, not only Pepr's own source checkout.

## Lessons Learned

- A repo-local `patch-package` fix can make Pepr's own build pass while still leaving generated modules broken. The compatibility boundary is the packed or published Pepr package installed into a separate module project.
- `npx --package <tarball> pepr init` can run from a directory that is not itself a package root. Postinstall wrappers should only treat `INIT_CWD` as the install target when it contains a `package.json`; otherwise they should fall back to Pepr's package root.
- Dockerfiles that run `npm ci` need the `patches/` directory copied before install scripts execute. After build, use `npm prune --omit=dev --omit=peer` instead of reinstalling dependencies, then remove patch files from final image content if they are not needed at runtime.
- CI checks should distinguish patch applicability from consumer compatibility. `npx patch-package --error-on-fail` proves the committed patch still applies; a generated-module tarball install and `pepr build` proves module authors are not required to own the workaround.
- Generated modules should inherit as few Pepr dev dependencies as practical. When they do inherit a tool or type dependency, Pepr owns making that generated default buildable.

## Consequences

- Dependency updates can proceed while small upstream fixes are waiting to merge or release.
- Patch files become part of normal code review, rather than being hidden in local `node_modules` state.
- `npm ci` applies committed patches through `postinstall`.
- When a transitive declaration bug affects generated modules, Pepr carries the temporary patch so a freshly generated module can build without module authors adding their own patch tooling.
- CI can run `npx patch-package --error-on-fail` to prove patches still apply cleanly before running build and tests.
- CI should include a generated-module compatibility test that installs the packed Pepr tarball and builds without source-checkout patch access.
- We keep `skipLibCheck` disabled for the library build and avoid downgrading unrelated type packages just to bypass a transitive declaration bug.
- Temporary patches add maintenance cost. Each patch must have a linked upstream reference and a removal tracker so it does not become permanent by accident.
- If a dependency version changes enough that a patch no longer applies, CI should fail and force a decision: update the patch, remove it because upstream fixed the issue, or choose a different mitigation.

## Alternatives Considered

**Wait for upstream release.** This avoids local patching, but blocks dependency updates for an unknown amount of time.

**Pin or downgrade the conflicting dependency.** This can be acceptable for short-lived updates, but in this case it would hold back `@types/node@26` and avoid the actual compatibility problem rather than documenting it.

**Set `skipLibCheck: true`.** This would bypass the TypeScript error, but it weakens dependency declaration checking across the project.

**Maintain a fork.** A fork is heavier than needed for a one-line declaration fix and creates more long-term ownership burden.

**Use a custom postinstall script.** This avoids adding a dependency, but creates repo-specific patch machinery where a standard patch artifact is clearer.

## Follow-up

Temporary dependency patches must include a cleanup path. For the `thread-stream` workaround, remove `patches/thread-stream+*.patch`, remove `patch-package` if no other patches remain, and remove any patch-specific CI verification when Pepr bumps `pino` to a version that resolves the `thread-stream` declaration fix and `npm run build` passes without the local patch.

Tracking issue: [#3297](https://github.com/defenseunicorns/pepr/issues/3297).
