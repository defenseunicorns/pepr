// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { it, beforeAll } from "@jest/globals";

import { execSync } from "child_process";
import { promises as fs } from "fs";
import { resolve } from "path";
import { cwd } from "./entrypoint.test";
import { validateZarfYaml, outputDir, validateOverridesYamlRbac } from "./pepr-build.helpers";

export function peprBuild() {
  beforeAll(async () => {
    const dir = resolve(cwd);
    await fs.mkdir(outputDir, { recursive: true });
    await addScopedRbacMode();
  });
  it("should successfully build the Pepr project with arguments and rbacMode scoped", async () => {
    execSync(`npx pepr build -r gchr.io/defenseunicorns -o ${outputDir}`, {
      cwd: cwd,
      stdio: "inherit",
    });
  });

  it("should generate produce the K8s yaml file", async () => {
    await fs.access(resolve(cwd, outputDir, "pepr-module-static-test.yaml"));
  });

  it("should generate a custom image in zarf.yaml", async () => {
    await fs.access(resolve(cwd, outputDir, "zarf.yaml"));
    const expectedImage = `gchr.io/defenseunicorns/custom-pepr-controller:${execSync("npx pepr --version", { cwd }).toString().trim()}`;

    await validateZarfYaml(expectedImage);
  });

  it("should generate a scoped ClusterRole", async () => {
    await validateOverridesYamlRbac();
  });
}

// Set rbacMode in the Pepr Module Config and write it back to disk
async function addScopedRbacMode() {
  const packageJson = await fs.readFile(resolve(cwd, "package.json"), "utf8");
  const packageJsonObj = JSON.parse(packageJson);
  packageJsonObj.pepr.rbacMode = "scoped";
  await fs.writeFile(resolve(cwd, "package.json"), JSON.stringify(packageJsonObj, null, 2));
}
