import { createDirectoryIfNotExists } from "../lib/filesystemService";
import { sanitizeResourceName } from "../sdk/sdk";
import { createDockerfile } from "../lib/included-files";
import { execSync } from "child_process";
import { CapabilityExport } from "../lib/types";
import { validateCapabilityNames } from "../lib/helpers";
import { BuildOptions, BuildResult, context, BuildContext } from "esbuild";
import { Assets } from "../lib/assets/assets";
import { resolve } from "path";
import { promises as fs } from "fs";
import { generateAllYaml } from "../lib/assets/yaml/generateAllYaml";
import { webhookConfigGenerator } from "../lib/assets/webhooks";
import { generateZarfYamlGeneric } from "../lib/assets/yaml/generateZarfYaml";
import {
  getDeployment,
  getModuleSecret,
  getWatcher,
  service,
  watcherService,
} from "../lib/assets/k8sObjects";

interface ImageOptions {
  customImage?: string;
  registryInfo?: string;
  peprVersion?: string;
  registry?: string;
}
/**
 * Assign image string
 * @param imageOptions CLI options for image
 * @returns image string
 */
export function assignImage(imageOptions: ImageOptions): string {
  const { customImage, registryInfo, peprVersion, registry } = imageOptions;
  if (customImage) {
    return customImage;
  }

  if (registryInfo) {
    return `${registryInfo}/custom-pepr-controller:${peprVersion}`;
  }

  if (registry) {
    return checkIronBankImage(registry, "", peprVersion!);
  }

  return "";
}

export type Reloader = (opts: BuildResult<BuildOptions>) => void | Promise<void>;
/**
 * Determine the RBAC mode based on the CLI options and the module's config
 * @param opts CLI options
 * @param cfg Module's config
 * @returns The determined RBAC mode
 * @example
 */
export function determineRbacMode(
  opts: { rbacMode?: string },
  cfg: { pepr: { rbacMode?: string } },
): string {
  // CLI overrides the module's config
  if (opts.rbacMode) {
    return opts.rbacMode;
  }

  // if rbacMode is defined and not scoped, return admin
  if (cfg.pepr.rbacMode && cfg.pepr.rbacMode !== "scoped") {
    return "admin";
  }

  // if nothing is defined return admin, else return scoped
  return cfg.pepr.rbacMode || "admin";
}

/**
 * Handle the custom output directory
 * @param outputDir the desired output directory
 * @returns The desired output directory or the default one
 */

export async function createOutputDirectory(outputDir: string): Promise<string> {
  try {
    const dir = outputDir === "" ? "dist" : outputDir;
    await createDirectoryIfNotExists(dir);
    return dir;
  } catch (error) {
    console.error(`Error creating output directory: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Check if the image is from Iron Bank and return the correct image
 * @param registry The registry of the image
 * @param image The image to check
 * @param peprVersion The version of the Pepr controller
 * @returns The image string
 * @example
 */
export function checkIronBankImage(registry: string, image: string, peprVersion: string): string {
  return registry === "Iron Bank"
    ? `registry1.dso.mil/ironbank/opensource/defenseunicorns/pepr/controller:v${peprVersion}`
    : image;
}

/**
 * Check if the image pull secret is a valid Kubernetes name
 * @param imagePullSecret
 * @returns boolean
 */
export function validImagePullSecret(imagePullSecretName: string): void {
  if (imagePullSecretName) {
    const error = "Invalid imagePullSecret. Please provide a valid name as defined in RFC 1123.";
    if (sanitizeResourceName(imagePullSecretName) !== imagePullSecretName) {
      // https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#dns-subdomain-names
      console.error(error);
      process.exit(1);
    }
  }
}

/**
 * Creates and pushes a custom image for WASM or any other included files
 * @param includedFiles
 * @param peprVersion
 * @param description
 * @param image
 */
export async function handleCustomImageBuild(
  includedFiles: string[],
  peprVersion: string,
  description: string,
  image: string,
): Promise<void> {
  if (includedFiles.length > 0) {
    await createDockerfile(peprVersion, description, includedFiles);
    execSync(`docker build --tag ${image} -f Dockerfile.controller .`, {
      stdio: "inherit",
    });
    execSync(`docker push ${image}`, { stdio: "inherit" });
  }
}

/**
 * Check if the capability names are valid
 * @param capabilities The capabilities to check
 */
export function handleValidCapabilityNames(capabilities: CapabilityExport[]): void {
  try {
    // wait for capabilities to be loaded and test names
    validateCapabilityNames(capabilities);
  } catch (e) {
    console.error(`Error loading capability:`, e);
    process.exit(1);
  }
}

/**
 * Watch for changes in the module
 * @param ctxCfg The build options
 * @param reloader The reloader function
 * @returns The build context
 */
export async function watchForChanges(
  ctxCfg: BuildOptions,
  reloader: Reloader | undefined,
): Promise<BuildContext<BuildOptions>> {
  const ctx = await context(ctxCfg);

  // If the reloader function is defined, watch the module for changes
  if (reloader) {
    await ctx.watch();
  } else {
    // Otherwise, just build the module once
    await ctx.rebuild();
    await ctx.dispose();
  }

  return ctx;
}

export async function generateYamlAndWriteToDisk(obj: {
  uuid: string;
  imagePullSecret: string;
  outputDir: string;
  assets: Assets;
  zarf: string;
}): Promise<void> {
  const { uuid, imagePullSecret, outputDir, assets, zarf } = obj;
  const yamlFile = `pepr-module-${uuid}.yaml`;
  const chartPath = `${uuid}-chart`;
  const yamlPath = resolve(outputDir, yamlFile);
  try {
    const yaml = await assets.allYaml(
      generateAllYaml,
      {
        getDeploymentFunction: getDeployment,
        getWatcherFunction: getWatcher,
        getServiceFunction: service,
        getWatcherServiceFunction: watcherService,
      },
      imagePullSecret,
    );
    const zarfPath = resolve(outputDir, "zarf.yaml");

    let localZarf = "";
    if (zarf === "chart") {
      localZarf = assets.zarfYamlChart(generateZarfYamlGeneric, chartPath);
    } else {
      localZarf = assets.zarfYaml(generateZarfYamlGeneric, yamlFile);
    }
    await fs.writeFile(yamlPath, yaml);
    await fs.writeFile(zarfPath, localZarf);

    await assets.generateHelmChart(webhookConfigGenerator, getWatcher, getModuleSecret, outputDir);
    console.info(`K8s resource for the module saved to ${yamlPath}`);
  } catch (error) {
    console.error(`Error generating YAML: ${error}`);
    process.exit(1);
  }
}
