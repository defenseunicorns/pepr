// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import json from "@rollup/plugin-json";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { resolve } from "path";
import { promises as fs } from "fs";

import { ExternalOption, InputPluginOption, rollup } from "rollup";
import { RootCmd } from "./root";
import { Log } from "../lib";

const externalLibs: ExternalOption = [
  /@kubernetes\/client-node(\/.*)?/,
  "commander",
  "express",
  "fast-json-patch",
  "ramda",
];

const plugins: InputPluginOption = [
  nodeResolve({
    preferBuiltins: true,
  }),
  json(),
  typescript({
    tsconfig: "./tsconfig.json",
    declaration: false,
    sourceMap: false,
  }),
];

export async function buildModule(moduleDir: string) {
  try {
    // Resolve the path to the module's index.ts file
    const modulePath = resolve(moduleDir, "index.ts");

    // Read the module's UUID from the index.ts filel
    const moduleText = await fs.readFile(modulePath, { encoding: "utf-8" });
    const match = moduleText.match(/peprModuleUUID:\s*"(.+?)"/);
    const peprModuleUUID = match && match[1];
    const name = `pepr-${peprModuleUUID}.js`;

    // Exit if the module's UUID could not be found
    if (!peprModuleUUID) {
      throw new Error("Could not load the peprModuleUUID in index.ts");
    }

    // Build the module using Rollup
    const bundle = await rollup({
      plugins,
      external: externalLibs,
      treeshake: true,
      input: modulePath,
    });

    // Write the module to the dist directory
    await bundle.write({
      dir: "dist",
      format: "cjs",
      entryFileNames: name,
    });

    return resolve("dist", name);
  } catch (e) {
    // On any other error, exit with a non-zero exit code
    Log.error(e.message);
    process.exit(1);
  }
}

export default function (program: RootCmd) {
  program
    .command("build")
    .description("Build a Pepr Module for deployment")
    .action(async opts => {
      const moduleDir = opts.dir;
      const output = await buildModule(moduleDir);
      Log.info(`Module built successfully at ${output}`);
    });
}
