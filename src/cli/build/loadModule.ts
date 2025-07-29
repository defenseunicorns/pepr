import fs from "fs/promises";
import { resolve, dirname } from "path/posix";
import { version } from "../init/templates";
import { PeprConfig } from "../types";

export type LoadModuleReturn = {
  cfg: PeprConfig;
  entryPointPath: string;
  modulePath: string;
  name: string;
  path: string;
  uuid: string;
};

export async function loadModule(outputDir: string, entryPoint: string): Promise<LoadModuleReturn> {
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
