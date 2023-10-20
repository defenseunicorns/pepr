// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, it } from "@jest/globals";
import { loadYaml } from "@kubernetes/client-node";
import { execSync } from "child_process";
import { promises as fs } from "fs";
import { resolve } from "path";

import { cwd } from "./entrypoint.test";

export function peprBuild() {
  it("should successfully build the Pepr project", async () => {
    execSync("npx pepr build", { cwd: cwd, stdio: "inherit" });
  });

  it("should generate produce the K8s yaml file", async () => {
    await fs.access(resolve(cwd, "dist", "pepr-module-static-test.yaml"));
  });

  it("should generate the zarf.yaml f", async () => {
    await fs.access(resolve(cwd, "dist", "zarf.yaml"));
    await validateZarfYaml();
  });

  it('should generate correct ClusterRole yaml', async () => {
    await validateClusterRoleYaml()
  });
}

async function validateClusterRoleYaml() {
  // Read the generated yaml files
  const k8sYaml = await fs.readFile(resolve(cwd, "dist", "pepr-module-static-test.yaml"), "utf8");

  // The expected ClusterRole
  const expectedClusterRoleYaml = {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "ClusterRole",
    metadata: {
      name: "pepr-module-static-test",
    },
    rules: [
      {
        apiGroups: [""],
        resources: ["namespaces"],
        verbs: ["get", "list", "create","watch"],
      },
      {
        apiGroups: [""],
        resources: ["configmaps"],
        verbs: ["get", "list", "create","watch","update","delete"],
      },
      {
        apiGroups: [""],
        resources: ["secrets"],
        verbs: ["get", "list", "create"],
      },
      {
        apiGroups: ["pepr.dev"],
        resources: ["unicorns"],
        verbs: ["get", "list", "create"],
      },
    ],
  };

  // Check the generated cluster role yaml
  const actualClusterRoleYaml = loadYaml(k8sYaml);
  expect(actualClusterRoleYaml).toEqual(expectedClusterRoleYaml);
}

async function validateZarfYaml() {
  // Get the version of the pepr binary
  const peprVer = execSync("npx pepr --version", { cwd }).toString().trim();

  // Read the generated yaml files
  const k8sYaml = await fs.readFile(resolve(cwd, "dist", "pepr-module-static-test.yaml"), "utf8");
  const zarfYAML = await fs.readFile(resolve(cwd, "dist", "zarf.yaml"), "utf8");

  // The expected image name
  const expectedImage = `ghcr.io/defenseunicorns/pepr/controller:v${peprVer}`;

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

  // Check the generated k8s yaml
  expect(k8sYaml).toMatch(`image: ${expectedImage}`);
}
