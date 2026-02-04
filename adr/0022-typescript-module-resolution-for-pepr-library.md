# 22. TypeScript Module Resolution for Pepr Library

Date: 2026-02-04

## Status

Accepted

## Context

The Pepr library is a published npm package. TypeScript's guidance for library authors recommends stricter module resolution settings to ensure declaration files are compatible with all consumer configurations.

This is distinct from user Pepr modules (covered in [ADR-0021](./0021-typescript-module-resolution-for-pepr-modules.md)), which use `moduleResolution: "bundler"` because they are always bundled by esbuild.

The previous configuration used `moduleResolution: "node"`, which is now considered legacy and deprecated in favor of `node16`/`nodenext`.

## Decision

Use `moduleResolution: "NodeNext"` for the Pepr library:

```json
{
  "module": "NodeNext",
  "moduleResolution": "NodeNext"
}
```

**Why NodeNext:**

- Tracks Node.js module resolution evolution automatically
- TypeScript team's recommendation for actively maintained libraries
- Ensures declaration files work with consumers using any moduleResolution setting
- Pepr already targets modern Node.js (ES2022)

**Why not `bundler`:**

- `bundler` is for applications that are always bundled
- Library consumers may not use a bundler
- Declaration files must work in all contexts

## Consequences

- Declaration files are generated with strict Node.js-compatible resolution
- No source code changes required (imports already compatible)
- Aligns with TypeScript best practices for npm packages

## References

- [TypeScript: Choosing Compiler Options](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html)
- [ADR-0021: Module Resolution for Pepr Modules](./0021-typescript-module-resolution-for-pepr-modules.md)
