/* eslint-disable no-undef */

import { analyzeMetafile, build } from "esbuild";
import packageJSON from "./package.json" with { type: "json" };

const { dependencies, peerDependencies } = packageJSON;
const external = Object.keys(dependencies).concat(
  Object.keys(peerDependencies),
  "@kubernetes/client-node",
);

const buildOpts = {
  bundle: true,
  external,
  format: "cjs",
  legalComments: "eof",
  metafile: true,
  platform: "node",
};

async function builder() {
  try {
    // Build the CLI
    const cli = await build({
      ...buildOpts,
      entryPoints: ["src/cli.ts"],
      outfile: "dist/cli.js",
      define: {
        "process.env.PEPR_PRETTY_LOGS": '"true"',
      },
    });

    console.log(await analyzeMetafile(cli.metafile));

    // Build the controller runtime
    const controller = await build({
      ...buildOpts,
      entryPoints: ["src/runtime/controller.ts"],
      outfile: "dist/controller.js",
    });

    console.log(await analyzeMetafile(controller.metafile));

    // Build the library (CJS)
    const lib = await build({
      ...buildOpts,
      entryPoints: ["src/lib.ts"],
      outfile: "dist/lib.js",
      sourcemap: true,
    });

    console.log(await analyzeMetafile(lib.metafile));

    // Build the library (ESM)
    const libEsm = await build({
      ...buildOpts,
      format: "esm",
      entryPoints: ["src/lib.ts"],
      outfile: "dist/lib.mjs",
      sourcemap: true,
    });

    console.log(await analyzeMetafile(libEsm.metafile));
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

builder();
