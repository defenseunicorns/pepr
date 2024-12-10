import { createDirectoryIfNotExists } from "../lib/filesystemService";
import { sanitizeResourceName } from "../sdk/sdk";
import { createDockerfile } from "../lib/included-files";
import { execSync } from "child_process";
import { CapabilityExport } from "../lib/types";
import { validateCapabilityNames } from "../lib/helpers";
import { peprFormat } from "./format";
import { BuildOptions, BuildResult, context, BuildContext } from "esbuild";

export type Reloader = (opts: BuildResult<BuildOptions>) => void | Promise<void>;
/**
 * Determine the RBAC mode based on the CLI options and the module's config
 * @param opts CLI options
 * @param cfg Module's config
 * @returns The determined RBAC mode
 * @example
 * const opts = { rbacMode: "admin" };
 * const cfg = { pepr: { rbacMode: "scoped" } };
 * const result = determineRbacMode(opts, cfg);
 * console.log(result); // "admin"
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

export async function handleCustomOutputDir(outputDir: string): Promise<string> {
  const defaultOutputDir = "dist";
  if (outputDir) {
    try {
      await createDirectoryIfNotExists(outputDir);
      return outputDir;
    } catch (error) {
      console.error(`Error creating output directory: ${error.message}`);
      process.exit(1);
    }
  }
  return defaultOutputDir;
}

/**
 * Check if the image is from Iron Bank and return the correct image
 * @param registry The registry of the image
 * @param image The image to check
 * @param peprVersion The version of the PEPR controller
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
 * Constraint to majke sure customImage and registry are not both used
 * @param customImage
 * @param registry
 * @returns
 */
export function handleCustomImage(customImage: string, registry: string): string {
  let defaultImage = "";
  if (customImage) {
    if (registry) {
      console.error(`Custom Image and registry cannot be used together.`);
      process.exit(1);
    }
    defaultImage = customImage;
  }
  return defaultImage;
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
 * Disables embedding of deployment files into output module
 * @param embed
 * @param path
 * @returns
 */
export function handleEmbedding(embed: boolean, path: string): void {
  if (!embed) {
    console.info(`✅ Module built successfully at ${path}`);
    return;
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

export async function checkFormat() {
  const validFormat = await peprFormat(true);

  if (!validFormat) {
    console.log(
      "\x1b[33m%s\x1b[0m",
      "Formatting errors were found. The build will continue, but you may want to run `npx pepr format` to address any issues.",
    );
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
