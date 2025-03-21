// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { describe, expect, jest, it, beforeAll } from "@jest/globals";
import { execSync, execFileSync, spawnSync } from "child_process";
import { promises, readdirSync, existsSync, rmSync } from "fs";

import { waitForDeploymentReady } from "./k8s";
import path from "path";

jest.setTimeout(1000 * 60 * 5);

export function peprUpgrade() {
  let matchedFile = "";

  beforeAll(() => {
    const dirPath = "./pepr-upgrade-test";
    if (existsSync(dirPath)) {
      rmSync(dirPath, { recursive: true, force: true });
      console.log(`Old test directory removed: ${dirPath}`);
    }
    execSync(
      `npx pepr init --name pepr-upgrade-test --description "Upgrade testing" --errorBehavior "ignore" --uuid "upgrade-test" --skip-post-init --confirm`,
    );
  });

  it("should prepare, build, and deploy hello-pepr with pepr@latest", async () => {
    try {
      // Install pepr@latest
      execSync("npm i pepr@latest", { cwd: "pepr-upgrade-test", stdio: "inherit" });

      // Update manifests of pepr@latest
      execSync("node ./node_modules/pepr/dist/cli.js update --skip-template-update", {
        cwd: "pepr-upgrade-test",
        stdio: "inherit",
      });

      // Generate manifests with pepr@latest
      execSync("node ./node_modules/pepr/dist/cli.js build", {
        cwd: "pepr-upgrade-test",
        stdio: "inherit",
      });

      let manifestUUID;
      ({ manifestUUID, matchedFile } = getManifestData());

      // Deploy manifests of pepr@latest
      execFileSync("kubectl", ["create", "-f", matchedFile], {
        cwd: "pepr-upgrade-test",
        stdio: "inherit",
      });

      // Wait for the deployments to be ready
      await Promise.all([
        waitForDeploymentReady("pepr-system", `pepr-${manifestUUID}`),
        waitForDeploymentReady("pepr-system", `pepr-${manifestUUID}-watcher`),
      ]);
    } catch (error) {
      console.log(error);
      expect(error).toBeNull();
    }
  });

  it("should prepare, build, and deploy hello-pepr with pepr@pr-candidate", async () => {
    try {
      // Re-generate manifests with pepr@pr-candidate
      execSync("npx --yes ts-node ../src/cli.ts build -i pepr:dev", {
        cwd: "pepr-upgrade-test",
        stdio: "inherit",
      });

      let manifestUUID;
      ({ manifestUUID, matchedFile } = getManifestData());

      // Deploy manifests of pepr@latest
      const applyOut = spawnSync(`kubectl apply -f ${matchedFile}`, {
        shell: true,
        encoding: "utf-8",
        cwd: "pepr-upgrade-test",
      });

      const { status } = applyOut;

      // Validation should not return an error
      expect(status).toBe(0);

      // Wait for the deployments to be ready
      await Promise.all([
        waitForDeploymentReady("pepr-system", `pepr-${manifestUUID}`),
        waitForDeploymentReady("pepr-system", `pepr-${manifestUUID}-watcher`),
      ]);
    } catch (error) {
      expect(error).toBeNull();
    }
  });
}

describe("Should test Pepr upgrade", peprUpgrade);

function getManifestData(): { manifestUUID: string; matchedFile: string } {
  const moduleDirectory = path.join("./pepr-upgrade-test", "dist");
  const manifestPattern = /.*pepr-module-([a-f0-9-]+)\.yaml$/;

  let matchedFile = findMatchingFile(moduleDirectory, manifestPattern);
  if (!matchedFile) {
    console.error(`No manifest file found with pattern '${manifestPattern}'.`);
    process.exit(1);
  }

  // Remove "pepr-upgrade-test" from the start of the matched file path due to cwd of test
  matchedFile = matchedFile.replace(/^pepr-upgrade-test\//, "");

  const manifestUUID = matchedFile.match(manifestPattern)?.[1] || "NO-MATCH";

  console.log(`Manifest file: ${matchedFile}\nManifest UUID: ${manifestUUID}`);

  return { manifestUUID, matchedFile };
}

/**
 * Replace a string in a file and on error throws
 *
 * @param originalString - Original string to replace
 * @param newString - New string to replace with
 */
async function replaceString(filePath: string, originalString: string, newString: string) {
  try {
    let fileContent = await promises.readFile(filePath, "utf8");
    const modifiedContent = fileContent.split(originalString).join(newString);
    await promises.writeFile(filePath, modifiedContent, "utf8");
  } catch (error) {
    throw error;
  }
}

/**
 * @param dir The directory to search in
 * @param pattern The filename pattern (regex)
 * @returns The matched file name or empty-string if not found
 */
function findMatchingFile(dir: string, pattern: RegExp): string {
  if (!existsSync(dir)) {
    console.error(`Directory does not exist: ${dir}`);
    return "";
  }

  const files = readdirSync(dir);
  const matchedFile = files.find(file => pattern.test(file));

  return matchedFile ? path.join(dir, matchedFile) : "";
}
