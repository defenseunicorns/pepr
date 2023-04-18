// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import json from "@rollup/plugin-json";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { promises as fs } from "fs";
import { resolve } from "path";
import { ExternalOption, InputPluginOption, rollup } from "rollup";
import { dependencies } from "../../package.json";
import { Webhook } from "../../src/lib/k8s/webhook";
import Log from "../../src/lib/logger";
import { RootCmd } from "./root";

export default function (program: RootCmd) {
  program
    .command("build")
    .description("Build a Pepr Module for deployment")
    .option("-d, --dir [directory]", "Pepr module directory", ".")
    .action(async opts => {
      // Build the module
      const { cfg, path, uuid } = await buildModule(opts.dir);

      // Read the compiled module code
      const code = await fs.readFile(path);

      // Generate a secret for the module
      const webhook = new Webhook({
        ...cfg.pepr,
        description: cfg.description,
      });
      const yamlFile = `pepr-module-${uuid}.yaml`;
      const yamlPath = resolve("dist", yamlFile);
      const yaml = webhook.allYaml(code);

      const zarfPath = resolve("dist", "zarf.yaml");
      const zarf = webhook.zarfYaml(yamlFile);

      await fs.writeFile(yamlPath, yaml);
      await fs.writeFile(zarfPath, zarf);

      Log.debug(`Module compiled successfully at ${path}`);
      Log.info(`K8s resource for the module saved to ${yamlPath}`);
    });
}

// Create a list of external libraries to exclude from the bundle, these are already stored in the containe
const externalLibs: ExternalOption = Object.keys(dependencies).map(dep => new RegExp(`^${dep}.*`));

// Add the pepr library to the list of external libraries
externalLibs.push("pepr");

export async function buildModule(moduleDir: string) {
  try {
    // Resolve the path to the module's package.json file
    const cfgPath = resolve(moduleDir, "package.json");
    const input = resolve(moduleDir, "pepr.ts");

    // Read the module's UUID from the package.json filel
    const moduleText = await fs.readFile(cfgPath, { encoding: "utf-8" });
    const cfg = JSON.parse(moduleText);
    const { uuid } = cfg.pepr;
    const name = `pepr-${uuid}.js`;

    // Exit if the module's UUID could not be found
    if (!uuid) {
      throw new Error("Could not load the uuid in package.json");
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
        include: ["**/*.ts"],
      }),
    ];

    // Build the module using Rollup
    const bundle = await rollup({
      plugins,
      external: externalLibs,
      treeshake: true,
      input,
    });

    // Write the module to the dist directory
    await bundle.write({
      dir: "dist",
      format: "cjs",
      entryFileNames: name,
    });

    return {
      path: resolve("dist", name),
      cfg,
      uuid,
    };
  } catch (e) {
    // On any other error, exit with a non-zero exit code
    Log.debug(e);
    Log.error(e.message);
    process.exit(1);
  }
}
