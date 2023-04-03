// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { dumpYaml } from "@kubernetes/client-node";
import json from "@rollup/plugin-json";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { promises as fs } from "fs";
import { resolve } from "path";
import { ExternalOption, InputPluginOption, rollup } from "rollup";
import { Log } from "../lib";
import { moduleSecret } from "../lib/k8s/webhook";
import { RootCmd } from "./root";

const externalLibs: ExternalOption = [
  /@kubernetes\/client-node(\/.*)?/,
  "commander",
  "express",
  "fast-json-patch",
  "ramda",
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

    const plugins: InputPluginOption = [
      nodeResolve({
        preferBuiltins: true,
      }),
      json(),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
        removeComments: true,
        sourceMap: false,
      }),
    ];

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

    return {
      path: resolve("dist", name),
      uuid: peprModuleUUID,
    };
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
      // Build the module
      const { path, uuid } = await buildModule(opts.dir);

      // Read the compiled module code
      const code = await fs.readFile(path, { encoding: "utf-8" });

      // Generate a secret for the module
      const secret = moduleSecret(uuid, code);
      const yaml = dumpYaml(secret);
      const yamlPath = resolve("dist", `pepr-module-${uuid}.yaml`);

      await fs.writeFile(yamlPath, yaml);

      Log.debug(`Module compiled successfully at ${path}`);
      Log.info(`K8s resource for the module saved to ${yamlPath}`);
    });
}
