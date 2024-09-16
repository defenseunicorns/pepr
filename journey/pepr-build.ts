// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { loadAllYaml } from "@kubernetes/client-node";
import { beforeAll, expect, it } from "@jest/globals";
import { loadYaml } from "@kubernetes/client-node";
import { exec, execSync } from "child_process";
import { promises as fs } from "fs";
import { resolve } from "path";
import { V1ObjectMeta, KubernetesObject } from '@kubernetes/client-node';
import yaml from "js-yaml";
import { cwd } from "./entrypoint.test";

export function peprBuild() {

  const moduleName = "pepr-test-module"

  beforeAll(() => {
    execSync(`jq '.dependencies.pepr = "file:../0.0.0-development"' package.json > temp.json && mv temp.json package.json`, {cwd: 'pepr-test-module'})
    execSync('npm install', {cwd: 'pepr-test-module'})

    //Prepare the 'env' key in the test module's package.json
    const envValues = '{"MY_CUSTOM_VAR": "example-value","ZARF_VAR": "###ZARF_VAR_THING###"}'
    execSync(`jq \'.pepr.env = ${envValues}\' package.json > temp.json && mv temp.json package.json`, {cwd: 'pepr-test-module'});
  })

  it("should successfully build the Pepr project", async () => {

    execSync(`npx pepr build`, { cwd: cwd, stdio: "inherit" });
    validateHelmChart();
  });

  it("should generate the K8s yaml file", async () => {
    const files = fs.readdir(`${cwd}/dist`)
    const yamlFile = (await files).find(file => /.*pepr-module.*\.yaml/.test(file))
    await fs.access(resolve(cwd, "dist", yamlFile as string)); //TODO: Type coercion
    //Assert: What's a good assertion?
  });

  it("should generate the zarf.yaml file", async () => {
    await fs.access(resolve(cwd, "dist", "zarf.yaml"));
    await validateZarfYaml();
  });

  it("should correctly merge in the package.json env vars into the values.yaml helm chart file", async () => {
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
      const files = fs.readdir(`${cwd}/dist`)
      const yamlFile = (await files).find(file => /.*pepr-module.*\.yaml/.test(file))
      const chartDirectoryName = yamlFile?.split('.')[0].split('-').slice(-5).join("-").concat("-chart") as string; //TODO: Type coercion

      const valuesYaml = await fs.readFile(resolve(cwd, "dist", chartDirectoryName, "values.yaml"), "utf8");
      const valuesJSON = yaml.load(valuesYaml) as ValuesJSON;
      expect(valuesJSON.admission.env).toEqual(expectedAdmissionEnv);
      expect(valuesJSON.watcher!.env).toEqual(expectedWatcherEnv);
    } catch (error) {
      expect(error).toBeUndefined();
    }
  })
}

async function validateHelmChart() {

  const files = fs.readdir(`${cwd}/dist`)
  const yamlFile = (await files).find(file => /.*pepr-module.*\.yaml/.test(file))
  const chartDirectoryName = yamlFile?.split('.')[0].split('-').slice(-5).join("-").concat("-chart") as string; //TODO: Type coercion

  const k8sYaml = await fs.readFile(resolve(cwd, "dist", yamlFile as string), "utf8"); //TODO: Type coercion
  const helmOutput = execSync('helm template .', { cwd: `${cwd}/dist/${chartDirectoryName}`}).toString();

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

  const files = fs.readdir(`${cwd}/dist`)
  const yamlFile = (await files).find(file => /.*pepr-module.*\.yaml/.test(file))
  // Read the generated yaml files
  const k8sYaml = await fs.readFile(resolve(cwd, "dist", yamlFile as string), "utf8"); //TODO: Type coercion
  const zarfYAML = await fs.readFile(resolve(cwd, "dist", "zarf.yaml"), "utf8");

  // The expected image name
  const expectedImage = `ghcr.io/defenseunicorns/pepr/controller:v${peprVer}`;

  //TODO: get expected metadtaa.name in a better way
  const metadataName = yamlFile?.split('.')[0].split('-') as string[]; //TODO: Type coercion
  const expectedMetaDataName = metadataName[0].concat("-").concat(metadataName.slice(-5).join("-"));

  // The expected zarf yaml contents
  const expectedZarfYaml = {
    kind: "ZarfPackageConfig",
    metadata: {
      name: `${expectedMetaDataName}`,
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
            files: [`${yamlFile}`],
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
