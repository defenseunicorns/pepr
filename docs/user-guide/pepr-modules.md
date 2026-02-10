# Pepr Modules

## What is a Pepr Module?

A Pepr Module is a collection of [capabilities](https://docs.pepr.dev/main/user-guide/capabilities/), config and scaffolding in a Pepr Project. To create a module use the `npx pepr init` command.

## How Modules Are Built

Pepr modules are **always bundled** using [esbuild](https://esbuild.github.io/) before deployment. When you run `npx pepr build`, your TypeScript code is:

1. **Type-checked** using the TypeScript compiler
2. **Bundled** into a single JavaScript file with all your local code included
3. **Minified** to reduce file size
4. **Packaged** into Kubernetes manifests (or as a library with `--no-embed`)

### Why Bundling Matters

Because esbuild handles module resolution at build time, new Pepr modules use TypeScript's `moduleResolution: "bundler"` setting in their `tsconfig.json` file. This means:

- **No `.js` extensions are required** in your import statements
- **JSON imports work** without special syntax
- **The same code works** for both CommonJS and ESM output formats
- **Import errors are caught** during the build process by `esbuild`

If you're familiar with stricter Node.js module resolution (like `moduleResolution: "nodenext"`), note that Pepr modules never run as raw Node.js files; they're always processed by the bundler first.
Module authors may set the `package.json`'s `type` field to either `"commonjs"` or `"module"` in new modules.
See the [nodeJS docs](https://nodejs.org/api/packages.html#packagejson-and-file-extensions) for more detail.

### External Dependencies

When bundling, certain packages are marked as "external" and are **not** included in your bundle:

- `pepr` - The Pepr library (provided by the controller container)
- `@kubernetes/client-node` - Kubernetes client (provided by the controller container)
- Your npm dependencies listed in `package.json` (installed in the controller container)

This keeps your bundle small while ensuring all required dependencies are available at runtime.

### Output Formats

Pepr supports two module output formats:

| Format           | File Extension | When Used                                              |
| ---------------- | -------------- | ------------------------------------------------------ |
| CommonJS (CJS)   | `.js`          | Default, or when `package.json` has no `"type"` field  |
| ES Modules (ESM) | `.mjs`         | When `package.json` has `"type": "module"`             |

The format is auto-detected from your `package.json`. Both formats work identically in the Pepr controller.
