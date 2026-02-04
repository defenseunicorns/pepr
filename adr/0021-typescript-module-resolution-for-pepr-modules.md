# 21. TypeScript Module Resolution for Pepr Modules

Date: 2026-02-04

## Status

Accepted

## Context

With ESM build support ([issue #2925](https://github.com/defenseunicorns/pepr/issues/2925)), we needed to choose a TypeScript `moduleResolution` setting for `tsconfig.module.json`.

The two main options are:

| Setting | Behavior |
| ------- | -------- |
| `bundler` | Relaxed resolution for bundled apps. No `.js` extensions required. |
| `nodenext` | Strict Node.js resolution. Requires `.js` extensions on imports. |

[ADR-0003](./0003-use-commonjs-and-esbuild.md) previously noted frustration with the `.js` extension requirement when strict ESM resolution was attempted.

### Alternatives Considered

**`nodenext`: ** Maximum strictness, catches resolution errors at compile time, and ensures code works in raw Node.js. However, it requires explicit `.js` extensions on relative imports and `with { type: "json" }` syntax for JSON imports in ESM. This would be a breaking change for existing Pepr modules and require different code patterns for CJS vs ESM builds.

**Hybrid approach:** Keep `bundler` as default but provide tooling for stricter checking. Rejected as unnecessary complexity—users can override their tsconfig if needed.

## Decision

Use `moduleResolution: "bundler"` for Pepr modules:

```json
{
  "module": "ES2022",
  "moduleResolution": "bundler"
}
```

**Why:** Pepr modules are always bundled by esbuild before deployment. They never run as raw Node.js files. Since esbuild handles module resolution at build time, TypeScript's job is just type-checking—not enforcing Node.js resolution rules that don't apply.

**Benefits:**
- Same code works for both CJS and ESM output
- No `.js` extensions or special JSON import syntax needed
- No breaking changes to existing modules

**Trade-off:** Code won't be directly portable to unbundled Node.js contexts. This is acceptable since Pepr modules are never run unbundled.

## Consequences

- esbuild catches resolution errors during bundling
- Integration tests verify built modules load correctly
- Users wanting stricter checking can override their tsconfig:

```json
{
  "extends": "./tsconfig.module.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

## References

- [TypeScript: moduleResolution](https://www.typescriptlang.org/tsconfig/moduleResolution.html)
- [Is nodenext right for libraries?](https://blog.andrewbran.ch/is-nodenext-right-for-libraries-that-dont-target-node-js/) - Andrew Branch (TypeScript team)
