# 21. TypeScript Module Resolution

Date: 2026-02-04

## Status

Accepted

## Context

With ESM build support ([issue #2925](https://github.com/defenseunicorns/pepr/issues/2925)), we needed to choose TypeScript `moduleResolution` settings for two distinct contexts:

1. **User Pepr modules** - Code written by users that gets bundled by esbuild
2. **The Pepr library** - The npm package consumed by user modules

These contexts have different requirements because user modules are always bundled, while the library must work for all consumers.

[ADR-0003](./0003-use-commonjs-and-esbuild.md) previously noted frustration with the `.js` extension requirement when strict ESM resolution was attempted.

## Decision

### For User Modules (`tsconfig.module.json`)

Use `moduleResolution: "bundler"`:

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

### For the Pepr Library (`tsconfig.root.json`)

Use `moduleResolution: "NodeNext"`:

```json
{
  "module": "NodeNext",
  "moduleResolution": "NodeNext"
}
```

**Why:** The Pepr library is a published npm package. TypeScript's guidance for library authors recommends stricter settings to ensure declaration files are compatible with all consumer configurations.

**Benefits:**
- Tracks Node.js module resolution evolution automatically
- TypeScript team's recommendation for actively maintained libraries
- Ensures declaration files work with consumers using any moduleResolution setting
- Pepr already targets modern Node.js (ES2022)

### Alternatives Considered

**`nodenext` for user modules:** Maximum strictness, catches resolution errors at compile time, and ensures code works in raw Node.js. However, it requires explicit `.js` extensions on relative imports and `with { type: "json" }` syntax for JSON imports. This would be a breaking change for existing Pepr modules.

**`bundler` for the library:** Rejected because library consumers may not use a bundler, and declaration files must work in all contexts.

## Consequences

- User modules: esbuild catches resolution errors during bundling; integration tests verify built modules load correctly
- Library: Declaration files are generated with strict Node.js-compatible resolution
- No source code changes required (imports already compatible)
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

- [Is nodenext right for libraries?](https://blog.andrewbran.ch/is-nodenext-right-for-libraries-that-dont-target-node-js/) - Andrew Branch (TypeScript team)
- [Modules - Choosing Compiler Options](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html#im-writing-a-library)
- [Modules - ESM/CJS Interoperability](https://www.typescriptlang.org/docs/handbook/modules/appendices/esm-cjs-interop.html)
- [TypeScript: Choosing Compiler Options](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html)
- [TypeScript: moduleResolution](https://www.typescriptlang.org/tsconfig/moduleResolution.html)