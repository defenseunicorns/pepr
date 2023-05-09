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
    .action(async () => {
      // Build the module
      const { cfg, path, uuid } = await buildModule();

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

export async function buildModule() {
  try {
    // Resolve the path to the module's package.json file
    const cfgPath = resolve(".", "package.json");
    const input = resolve(".", "pepr.ts");

    // Ensure the module's package.json and pepr.ts files exist
    try {
      await fs.access(cfgPath);
      await fs.access(input);
    } catch (e) {
      Log.error(
        `Could not find ${cfgPath} or ${input} in the current directory. Please run this command from the root of your module's directory.`
      );
      process.exit(1);
    }

    // Read the module's UUID from the package.json file
    const moduleText = await fs.readFile(cfgPath, { encoding: "utf-8" });
    const cfg = JSON.parse(moduleText);
    const { uuid } = cfg.pepr;
    const name = `pepr-${uuid}.js`;

    // Read the module's version from the package.json file
    if (cfg.dependencies.pepr && !cfg.dependencies.pepr.includes("file:")) {
      const versionMatch = /(\d+\.\d+\.\d+)/.exec(cfg.dependencies.pepr);
      if (!versionMatch || versionMatch.length < 2) {
        throw new Error("Could not find the Pepr version in package.json");
      }
      cfg.pepr.version = versionMatch[1];
    }

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
    if (e instanceof Error) {
      Log.error(e.message);
    }
    process.exit(1);
  }
}
