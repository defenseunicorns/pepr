import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";

// Resolve the paths relative to the script
const scriptPath = __filename;
const here = path.dirname(scriptPath);
const root = path.dirname(here);

// Set the NPM cache directory
const npmCacheDir = path.join(here, "testroot", ".npm");
process.env["NPM_CONFIG_CACHE"] = npmCacheDir;

// Ensure the NPM cache directory exists
fs.mkdirSync(npmCacheDir, { recursive: true });
console.log(`Created local version of npm cache for testing: ${npmCacheDir}`);

try {
  // Run the build command
  console.log("Running npm build...");
  execSync("npm run build", { stdio: "inherit" });

  // Install the local package
  const localPackagePath = `file://${path.join(root, "pepr-0.0.0-development.tgz")}`;
  console.log(`Installing package from ${localPackagePath}...`);
  execSync(`npx --yes ${localPackagePath}`, { stdio: "inherit" });
} catch (error) {
  console.error("An error occurred:", error);
  process.exit(1);
}
