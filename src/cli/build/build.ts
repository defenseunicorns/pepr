// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Assets } from "../../lib/assets/assets";
import { Command } from "commander";
import { Option } from "commander";
import { parseTimeout } from "../../lib/helpers";
import {
  determineRbacMode,
  assignImage,
  createOutputDirectory,
  handleValidCapabilityNames,
  handleCustomImageBuild,
  validImagePullSecret,
  generateYamlAndWriteToDisk,
} from "./build.helpers";
import { buildModule } from "./asdf";

let outputDir: string = "dist";
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
    .option("-e, --entry-point <file>", "Specify the entry point file to build with.", "pepr.ts")
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
      outputDir = await createOutputDirectory(opts.output);

      // Build the module
      const buildModuleResult = await buildModule(
        outputDir,
        undefined,
        opts.entryPoint,
        opts.embed,
      );

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
        console.info(`Module built successfully at ${path}`);
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
