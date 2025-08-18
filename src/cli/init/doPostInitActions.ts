// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { execSync } from "child_process";
import Log from "../../lib/telemetry/logger";
export const doPostInitActions = (dirName: string): void => {
  // run npm install from the new directory
  process.chdir(dirName);
  execSync("npm install", {
    stdio: "inherit",
  });

  // setup git
  execSync("git init --initial-branch=main", {
    stdio: "inherit",
  });

  // try to open vscode
  try {
    execSync("code .", {
      stdio: "inherit",
    });
  } catch {
    Log.warn("VSCode was not found, IDE will not automatically open.");
  }
};
