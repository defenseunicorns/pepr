// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Assets } from "../../lib/assets/assets";
import { Command } from "commander";
import { Option } from "commander";
import { parseTimeout } from "../../lib/helpers";
import {
  determineRbacMode,
  determineModuleFormat,
  assignImage,
  createOutputDirectory,
  handleValidCapabilityNames,
  handleCustomImageBuild,
  validImagePullSecret,
  generateYamlAndWriteToDisk,
  fileExists,
} from "./build.helpers";
import { buildModule, BuildModuleReturn } from "./buildModule";
import Log from "../../lib/telemetry/logger";
import { resolve } from "path";

interface BuildOpts {
  customName?: string;
  customImage?: string;
  registryInfo?: string;
  registry?: string;
  rbacMode?: string;
  timeout?: number;
  embed: boolean;
  withPullSecret: string;
  zarf: string;
}

async function generateDeploymentAssets(
  buildResult: BuildModuleReturn,
  opts: BuildOpts,
  outputDir: string,
): Promise<void> {
  const { cfg, path } = buildResult;

  const image = assignImage({
    customImage: opts.customImage,
    registryInfo: opts.registryInfo,
    peprVersion: cfg.pepr.peprVersion,
    registry: opts.registry,
  });

  if (opts.timeout !== undefined) {
    cfg.pepr.webhookTimeout = opts.timeout;
  }

  if (opts.registryInfo !== undefined) {
    Log.info(`Including ${cfg.pepr.includedFiles.length} files in controller image.`);
    await handleCustomImageBuild(
      cfg.pepr.includedFiles,
      cfg.pepr.peprVersion,
      cfg.description,
      image,
    );
  }

  const assets = new Assets(
    {
      ...cfg.pepr,
      appVersion: cfg.version,
      description: cfg.description,
      alwaysIgnore: { namespaces: cfg.pepr.alwaysIgnore?.namespaces },
      rbacMode: determineRbacMode(opts, cfg),
    },
    path,
    opts.withPullSecret === "" ? [] : [opts.withPullSecret],
  );

  if (image !== "") assets.image = image;

  if (!validImagePullSecret(opts.withPullSecret)) {
    throw new Error("Invalid imagePullSecret. Please provide a valid name as defined in RFC 1123.");
  }

  handleValidCapabilityNames(assets.capabilities);
  await generateYamlAndWriteToDisk({
    uuid: cfg.pepr.uuid,
    outputDir,
    imagePullSecret: opts.withPullSecret,
    zarf: opts.zarf,
    assets,
  });
}

export default function (program: Command): void {
  program
    .command("build")
    .description("Build a Pepr Module for deployment")
    .addOption(
      new Option("-M, --rbac-mode <mode>", "Override module config and set RBAC mode.").choices([
        "admin",
        "scoped",
      ]),
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
    .option(
      "-e, --entry-point <file>",
      "Specify the entry point file to build with. (default: pepr.ts)",
      fileExists,
    )
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
    .option("-o, --output <directory>", "Set output directory.", "dist")
    .addOption(
      new Option(
        "-r, --registry <registry>",
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
    .addOption(
      new Option(
        "-f, --format <format>",
        "Output module format (cjs for CommonJS, esm for ES modules). Auto-detects from package.json 'type' field if not specified.",
      ).choices(["cjs", "esm"]),
    )
    .action(async opts => {
      const outputDir = await createOutputDirectory(opts.output);
      const format = determineModuleFormat(opts.format, resolve(process.cwd(), "package.json"));

      const buildModuleResult = await buildModule(outputDir, {
        entryPoint: opts.entryPoint,
        embed: opts.embed,
        format,
      });

      const { path } = buildModuleResult!;

      if (opts.customName) {
        process.env.PEPR_CUSTOM_BUILD_NAME = opts.customName;
      }

      if (!opts.embed) {
        Log.info(`Module built successfully at ${path}`);
        return;
      }

      await generateDeploymentAssets(buildModuleResult!, opts, outputDir);
    });
}
