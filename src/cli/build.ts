// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { execSync } from "child_process";
import { BuildOptions, BuildResult, analyzeMetafile, context } from "esbuild";
import { promises as fs } from "fs";
import { basename, extname, resolve } from "path";

import { Webhook } from "../lib/k8s/webhook";
import Log from "../lib/logger";
import { dependencies } from "./init/templates";
import { RootCmd } from "./root";

const peprTS = "pepr.ts";

export type Reloader = (opts: BuildResult<BuildOptions>) => void | Promise<void>;

export default function (program: RootCmd) {
  program
    .command("build")
    .description("Build a Pepr Module for deployment")
    .option(
      "-e, --entry-point [file]",
      "Specify the entry point file to build with. Note that changing this disables embedding of NPM packages.",
      peprTS
    )
    .action(async opts => {
      // Build the module
      const { cfg, path, uuid } = await buildModule(undefined, opts.entryPoint);

      // If building with a custom entry point, exit after building
      if (opts.entryPoint !== peprTS) {
        Log.info(`Module built successfully at ${path}`);
        return;
      }

      // Generate a secret for the module
      const webhook = new Webhook({
        ...cfg.pepr,
        version: cfg.version,
        description: cfg.description,
      });
      const yamlFile = `pepr-module-${uuid}.yaml`;
      const yamlPath = resolve("dist", yamlFile);
      const yaml = await webhook.allYaml(path);

      const zarfPath = resolve("dist", "zarf.yaml");
      const zarf = webhook.zarfYaml(yamlFile);

      await fs.writeFile(yamlPath, yaml);
      await fs.writeFile(zarfPath, zarf);

      Log.debug(`Module compiled successfully at ${path}`);
      Log.info(`K8s resource for the module saved to ${yamlPath}`);
    });
}

// Create a list of external libraries to exclude from the bundle, these are already stored in the container
const externalLibs = Object.keys(dependencies);

// Add the pepr library to the list of external libraries
externalLibs.push("pepr");

export async function loadModule(entryPoint = peprTS) {
  // Resolve the path to the module's package.json file
  const cfgPath = resolve(".", "package.json");
  const input = resolve(".", entryPoint);

  // Ensure the module's package.json and entrypoint files exist
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

  return {
    cfg,
    input,
    name,
    path: resolve("dist", name),
    uuid,
  };
}

export async function buildModule(reloader?: Reloader, entryPoint = peprTS) {
  try {
    const { cfg, path, uuid } = await loadModule(entryPoint);

    // Run `tsc` to validate the module's types
    execSync("./node_modules/.bin/tsc", { stdio: "inherit" });

    // Common build options for all builds
    const ctxCfg: BuildOptions = {
      bundle: true,
      entryPoints: [entryPoint],
      external: externalLibs,
      format: "cjs",
      keepNames: true,
      legalComments: "external",
      metafile: true,
      minify: true,
      outfile: path,
      plugins: [
        {
          name: "reload-server",
          setup(build) {
            build.onEnd(async r => {
              // Print the build size analysis
              if (r?.metafile) {
                console.log(await analyzeMetafile(r.metafile));
              }

              // If we're in dev mode, call the reloader function
              if (reloader) {
                await reloader(r);
              }
            });
          },
        },
      ],
      platform: "node",
      sourcemap: true,
      treeShaking: true,
    };

    if (reloader) {
      // Only minify the code if we're not in dev mode
      ctxCfg.minify = false;
    }

    // Handle custom entry points
    if (entryPoint !== peprTS) {
      // Don't minify if we're using a custom entry point
      ctxCfg.minify = false;

      // Preserve the original file name if we're using a custom entry point
      ctxCfg.outfile = resolve("dist", basename(entryPoint, extname(entryPoint))) + ".js";

      // Only bundle the NPM packages if we're not using a custom entry point
      ctxCfg.packages = "external";

      // Don't tree shake if we're using a custom entry point
      ctxCfg.treeShaking = false;
    }

    const ctx = await context(ctxCfg);

    // If the reloader function is defined, watch the module for changes
    if (reloader) {
      await ctx.watch();
    } else {
      // Otherwise, just build the module once
      await ctx.rebuild();
      await ctx.dispose();
    }

    return { ctx, path, cfg, uuid };
  } catch (e) {
    // On any other error, exit with a non-zero exit code
    Log.debug(e);
    if (e instanceof Error) {
      Log.error(e.message);
    }
    process.exit(1);
  }
}
