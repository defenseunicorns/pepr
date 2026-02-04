# 3. Use CommonJS and ESBuild

Date: 2023-05-22

## Status

Accepted (Partially Superseded)

> **Note**: This ADR was written when Pepr only supported CommonJS output. ESM build support has since been added. See [ADR-0021](./0021-typescript-module-resolution-for-pepr-modules.md) for the current module resolution strategy that supports both CJS and ESM builds.

## Context

As a Typescript-based project that is trying to create a Node.js Command Line Interface (CLI), a Node.js runtime component for Kubernetes (K8s), and a TypeScript (TS) Software Development Kit (SDK), there are some edge cases that we have encountered. The bottom line is CommonJS (CJS) and ECMA Script Modules (ESM) don't work well together in all cases. TS further complicates this by it's [odd stance](https://github.com/microsoft/TypeScript/issues/49083#issuecomment-1125503248) on making a pure import system.

Producing a clean JS SDK and JS CLI for NodeJS out of TS project is well-documented and suited the initial Pepr needs well. However, there were limitations to this model. Specifically a key value of Pepr is the `pepr dev` experience that allows zero-config breakpoint inspection in VSCode. Without leaning on `ts-node`, we [ran into issues](https://github.com/defenseunicorns/pepr/pull/94) preserving this experience or not creating very odd offset behaviors between the TS source and the transpiled code in the debugger. This same code must also produce the smallest possible output for the runtime controller in a single file, the presented the second issue where `pepr dev` would work due to `ts-node` magic, but the bundled output would break on ESM imports.

During the evaluation of alternative solutions, the codebase was [rewritten](https://github.com/defenseunicorns/pepr/pull/102/commits/80ed6c88d1b7789c318e04ca3adb98d40f1b46c5) to fully leverage ESM instead of CJS. Though this did solve some of the bundling issues, the DevX was very confusing due to the forced use of phantom `.js` files for imports in addition to odd behaviors with default imports. This made both developing and testing Pepr Modules confusing and frustrating.

Other build systems were explored, including [esbuild](https://esbuild.github.io/) to replace RollupJS.

## Decision

The decision has been made to implement CommonJS (CJS) in combination with ESBuild and TypeScript (tsc) in the Pepr project. This decision has been made with the objective of sustaining efficient debugging and breakpoints, operational CLI, SDK publishing, and successful bundling. esbuild is also what [Typescript themselves](https://github.com/microsoft/TypeScript/pull/51387) chose to use in their module system modernization efforts. This change also allowed the unification of the `pepr dev` and `pepr build` process to use the same code and configurations reducing risk of bugs in prod not being caught in dev.

## Consequences

The adoption of CJS with ESBuild and tsc is expected to resolve the disruptions caused by the integration of ESM dynamic imports and bundled output. The integration of ESBuild's superior bundling capabilities with tsc for type-checking and typedef generation is expected to enhance the build process and the overall user experience.

This decision does not introduce breaking changes in the existing system, highlighting its backward compatibility.
