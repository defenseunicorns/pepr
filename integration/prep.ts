// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
// This script makes a version of the npm cache for local use to avoid installing test artifacts into the global npm cache.
// This isn't an issue in CI where environments are ephemeral, but is useful for local testing.

import { execSync } from "child_process";
import { dirname, join } from "path";
import { mkdirSync } from "fs";

const here = dirname(__filename);
const root = dirname(here);
const npmCacheDir = join(here, "testroot", ".npm");

process.env["NPM_CONFIG_CACHE"] = npmCacheDir;
mkdirSync(npmCacheDir, { recursive: true });
console.log(`NPM cache directory initialized: ${npmCacheDir}`);

try {
  console.log("Building project...");
  execSync("npm run build", { stdio: "inherit" });

  const localPackagePath = `file://${join(root, "pepr-0.0.0-development.tgz")}`;
  console.log(`Installing local package: ${localPackagePath}`);
  execSync(`npx --yes ${localPackagePath}`, { stdio: "inherit" });
} catch (error) {
  console.error("Error:", error.message || error);
  process.exit(1);
}
