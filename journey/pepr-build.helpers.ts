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

export async function validateZarfYaml(expectedImage: string) {
  // Read the generated yaml files
  const zarfYAML = await fs.readFile(resolve(cwd, "dist", "zarf.yaml"), "utf8");

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

export async function validateClusterRoleYaml() {
  // Read the generated yaml files
  const k8sYaml = await fs.readFile(
    resolve(cwd, outputDir, "pepr-module-static-test.yaml"),
    "utf8",
  );
  const cr = await fs.readFile(resolve("journey", "resources", "clusterrole.yaml"), "utf8");
  expect(k8sYaml.includes(cr)).toEqual(true);
}

export async function validateOverridesYamlRbac() {
  const yamlChartRBAC = await fs.readFile(resolve("journey", "resources", "values.yaml"), "utf8");
  const expectedYamlChartRBAC = await fs.readFile(
    resolve("journey", "resources", "values.yaml"),
    "utf8",
  );
  const jsonChartRBAC = yaml.load(yamlChartRBAC) as Record<string, PolicyRule[]>;
  const expectedJsonChartRBAC = yaml.load(expectedYamlChartRBAC) as Record<string, PolicyRule[]>;

  expect(JSON.stringify(jsonChartRBAC)).toEqual(JSON.stringify(expectedJsonChartRBAC));
}
