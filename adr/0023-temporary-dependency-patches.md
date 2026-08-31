# 23. Temporary Dependency Patches

Date: 2026-08-31

## Status

Accepted

## Context

Pepr keeps dependencies current through Dependabot and scheduled peer dependency update workflows. Sometimes an upstream package has a small bug that blocks an otherwise valid dependency update, but the upstream fix is not merged or released yet.

The motivating case is `thread-stream`, a transitive dependency of `pino`. `@types/node@26` removed the deprecated `worker_threads.TransferListItem` alias, while `thread-stream@4.0.0` still referenced it in `index.d.ts`. That caused TypeScript to fail with:

```text
error TS2694: Namespace '"worker_threads"' has no exported member 'TransferListItem'.
```

Upstream issue pinojs/thread-stream#228 and PR pinojs/thread-stream#233 identify the fix: replace `workerThreads.TransferListItem[]` with `workerThreads.Transferable[]`. At the time of this decision, that fix was not available in a released package version.

We need a standard way to unblock dependency updates without weakening compiler checks, pinning unrelated dependency versions indefinitely, or maintaining forks for small temporary fixes.

## Decision

We will use [`patch-package`](https://www.npmjs.com/package/patch-package) for small, temporary dependency patches when all of the following are true:

- The upstream package blocks a dependency update or CI verification.
- The local patch is narrow, reviewable, and low-risk.
- There is an upstream issue, PR, release note, or other clear removal condition.
- We can verify the patched dependency through normal CI.

For npm installs, `package.json` will run `patch-package` from `postinstall` so committed patches are applied after `npm ci`. Patch files will be committed under `patches/`.

For the `thread-stream` case, the local patch applies the same one-line declaration change proposed upstream:

```diff
-  emit(eventName: 'message', message: any, transferList?: workerThreads.TransferListItem[]): boolean
+  emit(eventName: 'message', message: any, transferList?: workerThreads.Transferable[]): boolean
```

We will not use this mechanism for broad rewrites, behavior changes that require ownership, security fixes that need deeper review, or changes that should be carried as a maintained fork.

## Consequences

- Dependency updates can proceed while small upstream fixes are waiting to merge or release.
- Patch files become part of normal code review, rather than being hidden in local `node_modules` state.
- `npm ci` applies committed patches through `postinstall`.
- CI can run `npx patch-package --error-on-fail` to prove patches still apply cleanly before running build and tests.
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

Temporary dependency patches must include a cleanup path. For the `thread-stream` workaround, remove `patches/thread-stream+*.patch`, remove `patch-package` if no other patches remain, and remove any patch-specific CI verification once a released `thread-stream` version includes the `Transferable[]` declaration and `npm run build` passes without the local patch.

Tracking issue: [#3297](https://github.com/defenseunicorns/pepr/issues/3297).
