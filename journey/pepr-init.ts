// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { it } from "vitest";
import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { cwd } from "./entrypoint.test";

export function peprInit() {
  it("should create a new Pepr project", () => {
    const peprAlias = "file://./pepr-0.0.0-development.tgz";
    const args = [
      `--name pepr-test-module`,
      `--description "A test module for Pepr"`,
      `--error-behavior ignore`,
      `--uuid static-test`,
      `--skip-post-init`,
      "--yes",
    ].join(" ");
    execSync(`npx --yes ${peprAlias} init ${args}`, { stdio: "inherit" });

    // Add development version of Pepr to package.json instead of 0.0.0-development from template data
    const packageJsonPath = resolve(cwd, "package.json");
    const packageJsonContent = readFileSync(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonContent);
    packageJson.dependencies.pepr = "file:../pepr-0.0.0-development.tgz";
    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log(`Package pepr dependency updated to: ${packageJson.dependencies.pepr}`);
    // Install dependencies
    execSync("npm install", { cwd: cwd, stdio: "inherit" });
  });
}
