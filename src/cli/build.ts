// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { execSync } from "child_process";
import { BuildOptions, BuildResult, analyzeMetafile, context } from "esbuild";
import { promises as fs } from "fs";
import { basename, extname, resolve } from "path";
import { createDockerfile } from "../lib/included-files";
import { Assets } from "../lib/assets";
import { dependencies, version } from "./init/templates";
import { RootCmd } from "./root";
import { peprFormat } from "./format";
import { Option } from "commander";

const peprTS = "pepr.ts";

export type Reloader = (opts: BuildResult<BuildOptions>) => void | Promise<void>;

export default function (program: RootCmd) {
  program
    .command("build")
    .description("Build a Pepr Module for deployment")
    .option(
      "-e, --entry-point [file]",
      "Specify the entry point file to build with. Note that changing this disables embedding of NPM packages.",
      peprTS,
    )
    .option(
      "-r, --registry-info [<registry>/<username>]",
      "Registry Info: Image registry and username. Note: You must be signed into the registry",
    )
    .addOption(
      new Option("--rbac-mode [admin|scoped]", "Rbac Mode: admin, scoped (default: admin)")
        .choices(["admin", "scoped"])
        .default("admin"),
    )
    .action(async opts => {
      // Build the module
      const { cfg, path, uuid } = await buildModule(undefined, opts.entryPoint);

      // Files to include in controller image for WASM support
      const { includedFiles } = cfg.pepr;

      let image: string = "";

      if (opts.registryInfo !== undefined) {
        console.info(`Including ${includedFiles.length} files in controller image.`);

        // for journey test to make sure the image is built
        image = `${opts.registryInfo}/custom-pepr-controller:${cfg.dependencies.pepr}`;

        // only actually build/push if there are files to include
        if (includedFiles.length > 0) {
          await createDockerfile(cfg.dependencies.pepr, cfg.description, includedFiles);
          execSync(`docker build --tag ${image} -f Dockerfile.controller .`, { stdio: "inherit" });
          execSync(`docker push ${image}`, { stdio: "inherit" });
        }
      }

      // If building with a custom entry point, exit after building
      if (opts.entryPoint !== peprTS) {
        console.info(`✅ Module built successfully at ${path}`);
        return;
      }

      // Generate a secret for the module
      const assets = new Assets(
        {
          ...cfg.pepr,
          appVersion: cfg.version,
          description: cfg.description,
        },
        path,
      );

      // if image is a custom image, use that instead of the default
      if (image !== "") {
        assets.image = image;
      }

      const yamlFile = `pepr-module-${uuid}.yaml`;
      const yamlPath = resolve("dist", yamlFile);
      const yaml = await assets.allYaml(
        opts.rbacMode === undefined ? "" : opts.rbacMode.toString(),
      );

      const zarfPath = resolve("dist", "zarf.yaml");
      const zarf = assets.zarfYaml(yamlFile);

      await fs.writeFile(yamlPath, yaml);
      await fs.writeFile(zarfPath, zarf);

      console.info(`✅ K8s resource for the module saved to ${yamlPath}`);
    });
}

// Create a list of external libraries to exclude from the bundle, these are already stored in the container
const externalLibs = Object.keys(dependencies);

// Add the pepr library to the list of external libraries
externalLibs.push("pepr");

// Add the kubernetes client to the list of external libraries as it is pulled in by kubernetes-fluent-client
externalLibs.push("@kubernetes/client-node");

export async function loadModule(entryPoint = peprTS) {
  // Resolve the path to the module's package.json file
  const cfgPath = resolve(".", "package.json");
  const input = resolve(".", entryPoint);

  // Ensure the module's package.json and entrypoint files exist
  try {
    await fs.access(cfgPath);
    await fs.access(input);
  } catch (e) {
    console.error(
      `Could not find ${cfgPath} or ${input} in the current directory. Please run this command from the root of your module's directory.`,
    );
    process.exit(1);
  }

  // Read the module's UUID from the package.json file
  const moduleText = await fs.readFile(cfgPath, { encoding: "utf-8" });
  const cfg = JSON.parse(moduleText);
  const { uuid } = cfg.pepr;
  const name = `pepr-${uuid}.js`;

  // Set the Pepr version from the current running version
  cfg.pepr.peprVersion = version;

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

    const validFormat = await peprFormat(true);

    if (!validFormat) {
      console.log(
        "\x1b[33m%s\x1b[0m",
        "Formatting errors were found. The build will continue, but you may want to run `npx pepr format` to address any issues.",
      );
    }

    // Run `tsc` to validate the module's types
    execSync("./node_modules/.bin/tsc", { stdio: "pipe" });

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
    console.error(e.message);

    if (e.stdout) {
      const out = e.stdout.toString() as string;
      const err = e.stderr.toString();

      console.log(out);
      console.error(err);

      // Check for version conflicts
      if (out.includes("Types have separate declarations of a private property '_name'.")) {
        // Try to find the conflicting package
        const pgkErrMatch = /error TS2322: .*? 'import\("\/.*?\/node_modules\/(.*?)\/node_modules/g;
        out.matchAll(pgkErrMatch);

        // Look for package conflict errors
        const conflicts = [...out.matchAll(pgkErrMatch)];

        // If the regex didn't match, leave a generic error
        if (conflicts.length < 1) {
          console.warn(
            `\n\tOne or more imported Pepr Capabilities seem to be using an incompatible version of Pepr.\n\tTry updating your Pepr Capabilities to their latest versions.`,
            "Version Conflict",
          );
        }

        // Otherwise, loop through each conflicting package and print an error
        conflicts.forEach(match => {
          console.warn(
            `\n\tPackage '${match[1]}' seems to be incompatible with your current version of Pepr.\n\tTry updating to the latest version.`,
            "Version Conflict",
          );
        });
      }
    }

    // On any other error, exit with a non-zero exit code
    process.exit(1);
  }
}
