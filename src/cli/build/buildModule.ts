// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { execFileSync } from "child_process";
import { BuildOptions, analyzeMetafile } from "esbuild";
import { basename, extname, resolve } from "path";
import { dependencies } from "../init/templates";
import { peprFormat } from "../format";
import { watchForChanges } from "./build.helpers";
import { PeprConfig, Reloader } from "../types";
import { BuildContext } from "esbuild";
import { loadModule } from "./loadModule";

type BuildModuleReturn = {
  ctx: BuildContext<BuildOptions>;
  path: string;
  cfg: PeprConfig;
  uuid: string;
};
// Create a list of external libraries to exclude from the bundle, these are already stored in the container
const externalLibs = Object.keys(dependencies);

// Add the pepr library to the list of external libraries
externalLibs.push("pepr");

// Add the kubernetes client to the list of external libraries as it is pulled in by kubernetes-fluent-client
externalLibs.push("@kubernetes/client-node");

export async function buildModule(
  outputDir: string,
  reloader?: Reloader,
  entryPoint = "pepr.ts",
  embed = true,
): Promise<BuildModuleReturn | void> {
  try {
    const { cfg, modulePath, path, uuid } = await loadModule(outputDir, entryPoint);

    await checkFormat();
    // Resolve node_modules folder (in support of npm workspaces!)
    const npmRoot = execFileSync("npm", ["root"]).toString().trim();

    // Run `tsc` to validate the module's types & output sourcemaps
    const args = ["--project", `${modulePath}/tsconfig.json`, "--outdir", outputDir];
    execFileSync(`${npmRoot}/.bin/tsc`, args);

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
          setup(build): void | Promise<void> {
            build.onEnd(async r => {
              // Print the build size analysis
              if (r?.metafile) {
                console.info(await analyzeMetafile(r.metafile));
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

    // If not embedding (i.e. making a library module to be distro'd via NPM)
    if (!embed) {
      // Don't minify
      ctxCfg.minify = false;

      // Preserve the original file name
      ctxCfg.outfile = resolve(outputDir, basename(entryPoint, extname(entryPoint))) + ".js";

      // Don't bundle
      ctxCfg.packages = "external";

      // Don't tree shake
      ctxCfg.treeShaking = false;
    }

    const ctx = await watchForChanges(ctxCfg, reloader);

    return { ctx, path, cfg, uuid };
  } catch (e) {
    handleModuleBuildError(e);
  }
}

interface BuildModuleResult {
  stdout?: Buffer;
  stderr: Buffer;
}

function handleModuleBuildError(e: BuildModuleResult): void {
  console.error(`Error building module:`, e);

  if (!e.stdout) process.exit(1); // Exit with a non-zero exit code on any other error

  const out = e.stdout.toString() as string;
  const err = e.stderr.toString();

  console.info(out);
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
      console.info(
        `\n\tOne or more imported Pepr Capabilities seem to be using an incompatible version of Pepr.\n\tTry updating your Pepr Capabilities to their latest versions.`,
        "Version Conflict",
      );
    }

    // Otherwise, loop through each conflicting package and print an error
    conflicts.forEach(match => {
      console.info(
        `\n\tPackage '${match[1]}' seems to be incompatible with your current version of Pepr.\n\tTry updating to the latest version.`,
        "Version Conflict",
      );
    });
  }
}

async function checkFormat(): Promise<void> {
  const validFormat = await peprFormat(true);

  if (!validFormat) {
    console.info(
      "\x1b[33m%s\x1b[0m",
      "Formatting errors were found. The build will continue, but you may want to run `npx pepr format` to address any issues.",
    );
  }
}
