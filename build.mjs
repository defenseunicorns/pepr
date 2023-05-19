/* eslint-disable no-undef */

import { build } from "esbuild";

import packageJSON from "./package.json" assert { type: "json" };

const { dependencies, peerDependencies } = packageJSON;
const external = Object.keys(dependencies).concat(Object.keys(peerDependencies));

const buildOpts = {
  bundle: true,
  external,
  format: "cjs",
  platform: "node",
};

async function builder() {
  try {
    // Build the CLI
    await build({
      ...buildOpts,
      entryPoints: ["src/cli.ts"],
      outfile: "dist/cli.js",
    });

    // Build the controller runtime
    await build({
      ...buildOpts,
      entryPoints: ["src/cli/run.ts"],
      outfile: "dist/controller.js",
    });

    // Build the library
    await build({
      ...buildOpts,
      entryPoints: ["src/lib.ts"],
      outfile: "dist/lib.js",
      sourcemap: true,
    });
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

builder();
