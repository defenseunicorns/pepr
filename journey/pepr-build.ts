// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { loadAllYaml } from "@kubernetes/client-node";
import { expect, it } from "@jest/globals";
import { loadYaml } from "@kubernetes/client-node";
import { execSync } from "child_process";
import { promises as fs } from "fs";
import { resolve } from "path";
import { V1ObjectMeta, KubernetesObject } from '@kubernetes/client-node';
import yaml from "js-yaml";
import { cwd } from "./entrypoint.test";

export function peprBuild() {
  it("should successfully build the Pepr project", async () => {
    execSync("npx pepr build", { cwd: cwd, stdio: "inherit" });
    validateHelmChart();
  });

  it("should generate produce the K8s yaml file", async () => {
    await fs.access(resolve(cwd, "dist", "pepr-module-static-test.yaml"));
  });

  it("should generate the zarf.yaml f", async () => {
    await fs.access(resolve(cwd, "dist", "zarf.yaml"));
    await validateZarfYaml();
  });

  it("should correct merge in the package.json env vars into the values.yaml helm chart file", async () => {
    interface ValuesJSON {
      admission: {
        env: Record<string, string>[] | undefined;
      };
      watcher: {
        env: Record<string, string>[] | undefined;
      };
    }

    const expectedWatcherEnv = [
      {
        "name": "PEPR_PRETTY_LOG",
        "value": "false"
      },
      {
        "name": "LOG_LEVEL",
        "value": "info"
      },
      {
        "name": "MY_CUSTOM_VAR",
        "value": "example-value"
      },
      {
        "name": "ZARF_VAR",
        "value": "###ZARF_VAR_THING###"
      }
    ];

    const expectedAdmissionEnv = [
      {
        "name": "PEPR_PRETTY_LOG",
        "value": "false"
      },
      {
        "name": "LOG_LEVEL",
        "value": "info"
      },
      {
        "name": "MY_CUSTOM_VAR",
        "value": "example-value"
      },
      {
        "name": "ZARF_VAR",
        "value": "###ZARF_VAR_THING###"
      }
    ]

    try {
      const valuesYaml = await fs.readFile(resolve(cwd, "dist", "static-test-chart", "values.yaml"), "utf8");
      const valuesJSON = yaml.load(valuesYaml) as ValuesJSON;
      expect(valuesJSON.admission.env).toEqual(expectedAdmissionEnv);
      expect(valuesJSON.watcher!.env).toEqual(expectedWatcherEnv);
    } catch (error) {
      expect(error).toBeUndefined();
    }
  })
}

async function validateHelmChart() {

  const k8sYaml = await fs.readFile(resolve(cwd, "dist", "pepr-module-static-test.yaml"), "utf8");
  const helmOutput = execSync('helm template .', { cwd: `${cwd}/dist/static-test-chart` }).toString();

  const helmParsed = parseYAMLToJSON(helmOutput);
  const k8sParsed = parseYAMLToJSON(k8sYaml);

  expect(helmParsed).not.toBeNull();
  expect(k8sParsed).not.toBeNull();

  if (helmParsed && k8sParsed) {
    const helmJSON = sortKubernetesObjects(helmParsed);
    const expectedJSON = sortKubernetesObjects(k8sParsed);

    expect(helmJSON.toString()).toBe(expectedJSON.toString());
  }
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
  expect(k8sYaml).toMatch(`name: MY_CUSTOM_VAR`);
  expect(k8sYaml).toMatch(`value: example-value`);
  expect(k8sYaml).toMatch(`name: ZARF_VAR`);
  expect(k8sYaml).toMatch(`value: '###ZARF_VAR_THING###'`);
}

function parseYAMLToJSON(yamlContent: string): KubernetesObject[] | null {
  try {
    return loadAllYaml(yamlContent);
  } catch (e) {
    console.error(e);
    return null;
  }
}

function sortKubernetesObjects(objects: KubernetesObject[]): KubernetesObject[] {
  return objects.sort((a, b) => {
    if (a?.kind !== b?.kind) {
      return (a?.kind ?? '').localeCompare(b?.kind ?? '');
    }
    return ((a && a.metadata && (a.metadata as V1ObjectMeta)?.name) ?? '').localeCompare((b && b.metadata && (b.metadata as V1ObjectMeta)?.name) ?? '');
  });
}
