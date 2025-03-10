// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { promises as fs } from "fs";
import { resolve } from "path";
import { cwd } from "./entrypoint.test";
import { loadYaml } from "@kubernetes/client-node";
import { expect } from "@jest/globals";
import yaml from "js-yaml";
import { V1PolicyRule as PolicyRule } from "@kubernetes/client-node";

export const outputDir = "dist/pepr-test-module/child/folder";

/*
 * Validate the generated Zarf yaml file and image
 */
export async function validateZarfYaml(expectedImage: string, filePath: string) {
  // Read the generated yaml files from the child folder
  const zarfYAML = await fs.readFile(filePath, "utf8");

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
        images: [`${expectedImage}`],
      },
    ],
  };

  const actualZarfYaml = loadYaml(zarfYAML);
  expect(actualZarfYaml).toEqual(expectedZarfYaml);
}

/*
 * Validate the ClusterRole generated in the K8s yaml file has appropriate rules
 */
export async function validateClusterRoleYaml(manifestsPath: string) {
  // Read the generated yaml files
  const k8sYaml = await fs.readFile(manifestsPath, "utf8");
  const cr = await fs.readFile(resolve("journey", "resources", "clusterrole.yaml"), "utf8");
  expect(k8sYaml.includes(cr)).toEqual(true);
}

/*
 * Validate the values.yaml file in the helm chart has the appropriate RBAC rules
 */

export async function validateOverridesYamlRbac(valuesFilePath: string) {
  const yamlChartRBAC = await fs.readFile(valuesFilePath, "utf8");
  const expectedYamlChartRBAC = await fs.readFile(
    resolve("journey", "resources", "values.yaml"),
    "utf8",
  );
  const jsonChartRBAC = yaml.load(yamlChartRBAC) as Record<string, PolicyRule[]>;
  const expectedJsonChartRBAC = yaml.load(expectedYamlChartRBAC) as Record<string, PolicyRule[]>;

  expect(JSON.stringify(jsonChartRBAC.rbac)).toEqual(JSON.stringify(expectedJsonChartRBAC.rbac));
}
