// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { loadYaml } from "@kubernetes/client-node";
import { ExecutionContext } from "ava";
import { execSync } from "child_process";
import { promises as fs } from "fs";
import { resolve } from "path";

import { cwd } from "./entrypoint.test";

export async function peprBuild(t: ExecutionContext) {
  try {
    execSync("npx pepr build", { cwd: cwd, stdio: "inherit" });

    // check if the file exists
    await fs.access(resolve(cwd, "dist", "zarf.yaml"));
    await fs.access(resolve(cwd, "dist", "pepr-module-static-test.yaml"));

    // Validate the zarf.yaml file
    await validateZarfYaml(t);

    t.pass();
  } catch (e) {
    t.fail(e.message);
  }
}

async function validateZarfYaml(t: ExecutionContext) {
  try {
    t.log("Validating zarf.yaml");

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
    t.deepEqual(loadYaml(zarfYAML), expectedZarfYaml);

    // Check the generated k8s yaml
    t.true(k8sYaml.includes(`image: ${expectedImage}`));

    t.pass();
  } catch (e) {
    t.fail(e.message);
  }
}
