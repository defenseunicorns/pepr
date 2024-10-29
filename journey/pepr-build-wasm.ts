// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, it } from "@jest/globals";
import { loadYaml, V1PolicyRule as PolicyRule } from "@kubernetes/client-node";
import { execSync } from "child_process";
import { promises as fs } from "fs";
import { resolve } from "path";
import yaml from "js-yaml";
import { cwd } from "./entrypoint.test";

// test npx pepr build -o dst
const outputDir = "dist/pepr-test-module/child/folder";
export function peprBuild() {
  it("should build artifacts in the dst folder", async () => {
    await fs.mkdir(outputDir, { recursive: true });
  });

  it("should successfully build the Pepr project with arguments and rbacMode scoped", async () => {
    // Set rbacMode in the Pepr Module Config of the package.json.
    await addScopedRbacMode();
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
    await validateZarfYaml();
  });

  it("should generate a scoped ClusterRole", async () => {
    const validateHelmChart = true;
    await validateClusterRoleYaml(validateHelmChart);
  });
}

async function validateZarfYaml() {
  // Get the version of the pepr binary
  const peprVer = execSync("npx pepr --version", { cwd }).toString().trim();

  // Read the generated yaml files
  const k8sYaml = await fs.readFile(
    resolve(cwd, outputDir, "pepr-module-static-test.yaml"),
    "utf8",
  );
  const zarfYAML = await fs.readFile(resolve(cwd, outputDir, "zarf.yaml"), "utf8");

  // The expected image name
  const expectedImage = `gchr.io/defenseunicorns/custom-pepr-controller:0.0.0-development`;

  // The expected zarf yaml contents
  const expectedZarfYaml = {
    kind: "ZarfPackageConfig",
    metadata: {
      name: "pepr-static-test",
      description: "Pepr Module: A test module for Pepr",
      url: "https://github.com/defenseunicorns/pepr",
      version: "0.0.1",
    },
    components: [
      {
        name: "module",
        required: true,
        manifests: [
          {
            name: "module",
            namespace: "pepr-system",
            files: ["pepr-module-static-test.yaml"],
          },
        ],
        images: [expectedImage],
      },
    ],
  };

  // Check the generated zarf yaml
  const actualZarfYaml = loadYaml(zarfYAML);
  expect(actualZarfYaml).toEqual(expectedZarfYaml);
}

// Set rbacMode in the Pepr Module Config and write it back to disk
async function addScopedRbacMode() {
  const packageJson = await fs.readFile(resolve(cwd, "package.json"), "utf8");
  const packageJsonObj = JSON.parse(packageJson);
  console.log(JSON.stringify(packageJsonObj.pepr));
  packageJsonObj.pepr.rbacMode = "scoped";
  await fs.writeFile(resolve(cwd, "package.json"), JSON.stringify(packageJsonObj, null, 2));
}

async function validateClusterRoleYaml(validateChart: boolean = false) {
  // Read the generated yaml files
  const k8sYaml = await fs.readFile(
    resolve(cwd, outputDir, "pepr-module-static-test.yaml"),
    "utf8",
  );
  const cr = await fs.readFile(resolve("journey", "resources", "clusterrole.yaml"), "utf8");
  expect(k8sYaml.includes(cr)).toEqual(true);

  if (validateChart) {
    const yamlChartRBAC = await fs.readFile(resolve("journey", "resources", "values.yaml"), "utf8");
    const expectedYamlChartRBAC = await fs.readFile(
      resolve("journey", "resources", "values.yaml"),
      "utf8",
    );
    const jsonChartRBAC = yaml.load(yamlChartRBAC) as Record<string, PolicyRule[]>;
    const expectedJsonChartRBAC = yaml.load(expectedYamlChartRBAC) as Record<string, PolicyRule[]>;

    expect(JSON.stringify(jsonChartRBAC)).toEqual(JSON.stringify(expectedJsonChartRBAC));
  }
}
