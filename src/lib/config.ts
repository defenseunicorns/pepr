// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import fs from "fs";
import path from "path";
import Log from "./logger.js";
import { PackageJSON } from "./types.js";

export function getPackageJson() {
  // Determine the path to the package.json file.
  // process.cwd() returns the current working directory, which should be
  // the directory where the project was run from, which should contain the package.json file.
  const packageJsonPath = path.join(process.cwd(), "package.json");

  // Check if the file exists.
  if (!fs.existsSync(packageJsonPath)) {
    Log.error("package.json not found");
    process.exit(1);
  }

  // Read the file.
  const packageJsonData = fs.readFileSync(packageJsonPath, "utf8");

  // Parse the JSON data.
  const packageJson = JSON.parse(packageJsonData);

  // Now packageJson is an object representing the package.json data.
  Log.debug("loaded package.json", packageJson);

  return packageJson as PackageJSON;
}
