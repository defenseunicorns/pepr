// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { execFileSync } from "child_process";
import { BuildContext, BuildOptions, BuildResult, analyzeMetafile } from "esbuild";
import { promises as fs } from "fs";
import { basename, dirname, extname, resolve } from "path";
import { Assets } from "../lib/assets/assets";
import { dependencies, version } from "./init/templates";
import { RootCmd } from "./root";
import { Option } from "commander";
import { parseTimeout } from "../lib/helpers";
import { peprFormat } from "./format";
import { ModuleConfig } from "../lib/types";
import {
  watchForChanges,
  determineRbacMode,
  assignImage,
  handleCustomOutputDir,
  handleValidCapabilityNames,
  handleCustomImageBuild,
  validImagePullSecret,
  generateYamlAndWriteToDisk,
} from "./build.helpers";

const peprTS = "pepr.ts";
let outputDir: string = "dist";
export type Reloader = (opts: BuildResult<BuildOptions>) => void | Promise<void>;
export type PeprNestedFields = Pick<
  ModuleConfig,
  | "uuid"
  | "onError"
  | "webhookTimeout"
  | "customLabels"
  | "alwaysIgnore"
  | "env"
  | "rbac"
  | "rbacMode"
> & {
  peprVersion: string;
};

export type PeprConfig = Omit<ModuleConfig, keyof PeprNestedFields> & {
  pepr: PeprNestedFields & {
    includedFiles: string[];
  };
  description: string;
  version: string;
};

type LoadModuleReturn = {
  cfg: PeprConfig;
  entryPointPath: string;
  modulePath: string;
  name: string;
  path: string;
  uuid: string;
};

type BuildModuleReturn = {
  ctx: BuildContext<BuildOptions>;
  path: string;
  cfg: PeprConfig;
  uuid: string;
};

export default function (program: RootCmd): void {
  program
    .command("build")
    .description("Build a Pepr Module for deployment")
    .addOption(
      new Option("-M, --rbac-mode <admin|scoped>", "Set RBAC mode.").choices(["admin", "scoped"]),
    )
    .addOption(
      new Option(
        "-I, --registry-info <registry/username>",
        "Provide the image registry and username for building and pushing a custom WASM container. Requires authentication. Conflicts with --custom-image and --registry. Builds and pushes `'<registry/username>/custom-pepr-controller:<current-version>'`.",
      ).conflicts(["customImage", "registry"]),
    )
    .option("-P, --with-pull-secret <name>", "Use image pull secret for controller Deployment.", "")
    .addOption(
      new Option(
        "-c, --custom-name <name>",
        "Set name for zarf component and service monitors in helm charts.",
      ),
    )
    .option("-e, --entry-point <file>", "Specify the entry point file to build with.", peprTS)
    .addOption(
      new Option(
        "-i, --custom-image <image>",
        "Specify a custom image with version for deployments. Conflicts with --registry-info and --registry. Example: 'docker.io/username/custom-pepr-controller:v1.0.0'",
      ).conflicts(["registryInfo", "registry"]),
    )
    .option(
      "-n, --no-embed",
      "Disable embedding of deployment files into output module. Useful when creating library modules intended solely for reuse/distribution via NPM.",
    )
    .option("-o, --output <directory>", "Set output directory.")
    .addOption(
      new Option(
        "-r, --registry <GitHub|Iron Bank>",
        "Container registry: Choose container registry for deployment manifests. Conflicts with --custom-image and --registry-info.",
      )
        .conflicts(["customImage", "registryInfo"])
        .choices(["GitHub", "Iron Bank"]),
    )
    .option(
      "-t, --timeout <seconds>",
      "How long the API server should wait for a webhook to respond before treating the call as a failure.",
      parseTimeout,
    )
    .addOption(
      new Option("-z, --zarf <manifest|chart>", "Set Zarf package type")
        .choices(["manifest", "chart"])
        .default("manifest"),
    )
    .action(async opts => {
      // assign custom output directory if provided
      outputDir = await handleCustomOutputDir(opts.output);

      // Build the module
      const buildModuleResult = await buildModule(undefined, opts.entryPoint, opts.embed);

      const { cfg, path } = buildModuleResult!;
      // override the name if provided
      if (opts.customName) {
        process.env.PEPR_CUSTOM_BUILD_NAME = opts.customName;
      }

      const image = assignImage({
        customImage: opts.customImage,
        registryInfo: opts.registryInfo,
        peprVersion: cfg.pepr.peprVersion,
        registry: opts.registry,
      });

      // Check if there is a custom timeout defined
      if (opts.timeout !== undefined) {
        cfg.pepr.webhookTimeout = opts.timeout;
      }

      if (opts.registryInfo !== undefined) {
        console.info(`Including ${cfg.pepr.includedFiles.length} files in controller image.`);
        // for journey test to make sure the image is built

        // only actually build/push if there are files to include
        await handleCustomImageBuild(
          cfg.pepr.includedFiles,
          cfg.pepr.peprVersion,
          cfg.description,
          image,
        );
      }

      // If building without embedding, exit after building
      if (!opts.embed) {
        console.info(`✅ Module built successfully at ${path}`);
        return;
      }

      // Generate a secret for the module
      const assets = new Assets(
        {
          ...cfg.pepr,
          appVersion: cfg.version,
          description: cfg.description,
          alwaysIgnore: {
            namespaces: cfg.pepr.alwaysIgnore?.namespaces,
          },
          // Can override the rbacMode with the CLI option
          rbacMode: determineRbacMode(opts, cfg),
        },
        path,
        opts.withPullSecret === "" ? [] : [opts.withPullSecret],
      );

      if (image !== "") assets.image = image;

      // Ensure imagePullSecret is valid
      validImagePullSecret(opts.withPullSecret);

      handleValidCapabilityNames(assets.capabilities);
      await generateYamlAndWriteToDisk({
        uuid: cfg.pepr.uuid,
        outputDir,
        imagePullSecret: opts.withPullSecret,
        zarf: opts.zarf,
        assets,
      });
    });
}

// Create a list of external libraries to exclude from the bundle, these are already stored in the container
const externalLibs = Object.keys(dependencies);

// Add the pepr library to the list of external libraries
externalLibs.push("pepr");

// Add the kubernetes client to the list of external libraries as it is pulled in by kubernetes-fluent-client
externalLibs.push("@kubernetes/client-node");

export async function loadModule(entryPoint = peprTS): Promise<LoadModuleReturn> {
  // Resolve path to the module / files
  const entryPointPath = resolve(".", entryPoint);
  const modulePath = dirname(entryPointPath);
  const cfgPath = resolve(modulePath, "package.json");

  // Ensure the module's package.json and entrypoint files exist
  try {
    await fs.access(cfgPath);
    await fs.access(entryPointPath);
  } catch {
    console.error(
      `Could not find ${cfgPath} or ${entryPointPath} in the current directory. Please run this command from the root of your module's directory.`,
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
    entryPointPath,
    modulePath,
    name,
    path: resolve(outputDir, name),
    uuid,
  };
}

export async function buildModule(
  reloader?: Reloader,
  entryPoint = peprTS,
  embed = true,
): Promise<BuildModuleReturn | void> {
  try {
    const { cfg, modulePath, path, uuid } = await loadModule(entryPoint);

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

export async function checkFormat(): Promise<void> {
  const validFormat = await peprFormat(true);

  if (!validFormat) {
    console.log(
      "\x1b[33m%s\x1b[0m",
      "Formatting errors were found. The build will continue, but you may want to run `npx pepr format` to address any issues.",
    );
  }
}
