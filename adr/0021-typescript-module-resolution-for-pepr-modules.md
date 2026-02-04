# 21. TypeScript Module Resolution for Pepr Modules

Date: 2026-02-04

## Status

Accepted

## Context

With the addition of ESM build support (see [issue #2925](https://github.com/defenseunicorns/pepr/issues/2925)), we needed to evaluate the TypeScript module resolution strategy for `tsconfig.module.json`, which controls how user Pepr modules are type-checked before bundling.

TypeScript offers several `moduleResolution` options, each with different trade-offs:

### Option 1: `bundler` (Current Choice)

```json
{
  "module": "ES2022",
  "moduleResolution": "bundler"
}
```

**Pros:**
- Works for both CJS and ESM output formats without code changes
- No file extension requirements (`.js` not needed in imports)
- Supports JSON imports without special syntax
- Matches the reality that esbuild handles actual module resolution
- Simplest developer experience

**Cons:**
- Less strict than `nodenext` - allows imports that would fail in raw Node.js
- May mask issues if code is ever run without bundling
- TypeScript can't catch module resolution errors that only appear at runtime in Node.js
- Code written with bundler resolution may not work outside bundled contexts

### Option 2: `nodenext` / `node16` (Strict Node.js)

```json
{
  "module": "NodeNext",
  "moduleResolution": "NodeNext"
}
```

**Pros:**
- Maximum strictness - catches resolution errors at compile time
- Ensures code works in raw Node.js without bundling
- Understands `package.json` exports/imports fields correctly
- Recommended for library authors publishing to npm
- Future-proof (nodenext tracks Node.js evolution)

**Cons:**
- Requires explicit `.js` extensions on relative imports
- Requires `with { type: "json" }` for JSON imports in ESM
- Would be a breaking change for existing Pepr modules
- Different syntax needed for CJS vs ESM (can't use same template for both)
- More complex developer experience

This decision supersedes the CJS-only approach in [ADR-0003](./0003-use-commonjs-and-esbuild.md), which was written before ESM support was added. The original ADR noted frustration with "phantom `.js` files for imports" when using strict ESM resolution - this problem is avoided by using `bundler` resolution.

## Decision

We will use `moduleResolution: "bundler"` for Pepr module TypeScript configuration.

**Rationale:**

1. **Pepr's architecture**: esbuild always bundles the output, so `bundler` accurately reflects the actual resolution behavior at runtime
2. **User experience**: Pepr modules are always bundled before deployment - they never run as raw Node.js files
3. **Practical reliability**: Runtime module resolution is handled by esbuild, not Node.js directly - TypeScript just needs to type-check correctly
4. **Single template**: The same `tsconfig.module.json` works for both CJS and ESM builds without requiring code changes
5. **Historical precedent**: ADR-0003 documented the poor developer experience caused by strict ESM resolution requirements

**For users who want stricter checking**, they can override `tsconfig.module.json` in their Pepr module:

```json
{
  "extends": "./tsconfig.module.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

This would require updating their imports to use `.js` extensions and proper JSON import syntax for ESM.

## Consequences

### Positive

- Consistent developer experience for both CJS and ESM builds
- No breaking changes for existing Pepr modules
- Simpler onboarding - users don't need to understand Node.js module resolution nuances
- JSON imports work without special syntax

### Negative

- TypeScript won't catch module resolution errors that would only appear in unbundled Node.js execution
- Code written for Pepr may not be directly portable to non-bundled contexts without modification
- Users seeking maximum strictness must manually configure their tsconfig

### Mitigations

- Integration tests verify that built modules work correctly in the controller
- The build process (esbuild) will catch actual resolution errors during bundling
- Documentation notes that Pepr modules are always bundled, so `bundler` resolution is appropriate

## References

- [TypeScript TSConfig: moduleResolution](https://www.typescriptlang.org/tsconfig/moduleResolution.html)
- [TypeScript: Choosing Compiler Options](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html)
- [Is nodenext right for libraries?](https://blog.andrewbran.ch/is-nodenext-right-for-libraries-that-dont-target-node-js/) - Andrew Branch (TypeScript team)
- [ADR-0003: Use CommonJS and ESBuild](./0003-use-commonjs-and-esbuild.md)
