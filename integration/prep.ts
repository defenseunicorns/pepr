import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";

const scriptPath = __filename;
const here = path.dirname(scriptPath);
const root = path.dirname(here);

const npmCacheDir = path.join(here, "testroot", ".npm");
process.env["NPM_CONFIG_CACHE"] = npmCacheDir;

// Ensure the NPM cache directory exists
fs.mkdirSync(npmCacheDir, { recursive: true });
console.log(`Created local version of npm cache for testing: ${npmCacheDir}`);

try {
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
