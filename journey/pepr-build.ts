// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { loadAllYaml } from "@kubernetes/client-node";
import { expect, it } from "vitest";
import { execSync } from "child_process";
import { promises as fs } from "fs";
import { resolve } from "path";
import { V1ObjectMeta, KubernetesObject } from "@kubernetes/client-node";
import yaml from "js-yaml";
import { cwd } from "./entrypoint.test";
import { validateZarfYaml, validateClusterRoleYaml } from "./pepr-build.helpers";

export function peprBuild() {
  it("should build the Pepr module in scoped mode", async () => {
    execSync("npx pepr build --rbac-mode=scoped", { cwd: cwd, stdio: "inherit" });
    validateHelmChart();
  });

  it("should generate produce the K8s yaml file", async () => {
    await fs.access(resolve(cwd, "dist", "pepr-module-static-test.yaml"));
  });

  it("should generate the zarf.yaml file with the correct image", async () => {
    const zarfFilePath = resolve(cwd, "dist", "zarf.yaml");
    await fs.access(zarfFilePath);
    const expectedImage = `ghcr.io/defenseunicorns/pepr/controller:v${execSync("npx pepr --version", { cwd }).toString().trim()}`;
    await validateZarfYaml(expectedImage, zarfFilePath);
  });

  it("should generate a clusterRole that is least privileged", async () => {
    const kubernetesManifestPath = resolve(cwd, "dist", "pepr-module-static-test.yaml");
    await validateClusterRoleYaml(kubernetesManifestPath);
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
        name: "PEPR_PRETTY_LOG",
        value: "false",
      },
      {
        name: "LOG_LEVEL",
        value: "info",
      },
      {
        name: "MY_CUSTOM_VAR",
        value: "example-value",
      },
      {
        name: "ZARF_VAR",
        value: "###ZARF_VAR_THING###",
      },
    ];

    const expectedAdmissionEnv = [
      {
        name: "PEPR_PRETTY_LOG",
        value: "false",
      },
      {
        name: "LOG_LEVEL",
        value: "info",
      },
      {
        name: "MY_CUSTOM_VAR",
        value: "example-value",
      },
      {
        name: "ZARF_VAR",
        value: "###ZARF_VAR_THING###",
      },
    ];

    try {
      const valuesYaml = await fs.readFile(
        resolve(cwd, "dist", "static-test-chart", "values.yaml"),
        "utf8",
      );
      const valuesJSON = yaml.load(valuesYaml) as ValuesJSON;
      expect(valuesJSON.admission.env).toEqual(expectedAdmissionEnv);
      expect(valuesJSON.watcher!.env).toEqual(expectedWatcherEnv);
    } catch (error) {
      expect(error).toBeUndefined();
    }
  });
}

async function validateHelmChart() {
  const k8sYaml = await fs.readFile(resolve(cwd, "dist", "pepr-module-static-test.yaml"), "utf8");
  const helmOutput = execSync("helm template .", {
    cwd: `${cwd}/dist/static-test-chart`,
  }).toString();

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
      return (a?.kind ?? "").localeCompare(b?.kind ?? "");
    }
    return ((a && a.metadata && (a.metadata as V1ObjectMeta)?.name) ?? "").localeCompare(
      (b && b.metadata && (b.metadata as V1ObjectMeta)?.name) ?? "",
    );
  });
}
