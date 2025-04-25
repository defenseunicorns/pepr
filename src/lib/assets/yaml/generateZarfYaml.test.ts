// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { it, describe, expect } from "@jest/globals";
import { generateZarfYamlGeneric } from "./generateZarfYaml";
import { Assets } from "../assets";
import { ModuleConfig } from "../../types";
import { loadAllYaml } from "@kubernetes/client-node";

describe("generateZarfYamlGeneric", () => {
  const moduleConfig: ModuleConfig = {
    uuid: "test-uuid",
    alwaysIgnore: {
      namespaces: ["zarf"],
    },
    peprVersion: "0.0.2",
    appVersion: "0.0.2",
    description: "A test module",
    webhookTimeout: 10,
    onError: "reject",
    logLevel: "info",
    env: {},
    rbac: [],
    rbacMode: "scoped",
    customLabels: {},
  };
  const assets = new Assets(moduleConfig, "/tmp", ["secret1", "secret2"], "localhost");
  assets.capabilities = [];
  const zarfManifest = parseYAMLToJSON(
    generateZarfYamlGeneric(assets, "pepr-module-static-test.yaml", "manifests"),
  )![0];

  it("should generate the expected metadata", () => {
    expect(zarfManifest.metadata!.name).toBe("pepr-test-uuid");
    expect(zarfManifest.metadata!.description).toBe("Pepr Module: A test module");
    expect(zarfManifest.metadata!.version).toBe("0.0.2");
  });

  it("should generate the expected component for helm charts", () => {
    expect(zarfManifest.components[0].name).toBe("module");
    expect(zarfManifest.components[0].required).toBe(true);
    expect(zarfManifest.components[0].images[0]).toBe(
      "ghcr.io/defenseunicorns/pepr/controller:v0.0.2",
    );
    expect(zarfManifest.components[0].manifests![0].name).toBe("module");
    expect(zarfManifest.components[0].manifests![0].namespace).toBe("pepr-system");
    expect(zarfManifest.components[0].manifests![0].files[0]).toBe("pepr-module-static-test.yaml");
  });

  it("should generate the expected component for manifests", () => {
    const zarfChart = parseYAMLToJSON(
      generateZarfYamlGeneric(assets, "static-test-chart", "charts"),
    )![0];
    expect(zarfChart.components[0].charts![0].name).toBe("module");
    expect(zarfChart.components[0].charts![0].namespace).toBe("pepr-system");
    expect(zarfChart.components[0].charts![0].version).toBe("0.0.2");
    expect(zarfChart.components[0].charts![0].localPath).toBe("static-test-chart");
  });

  it("should default to 0.0.1 if no appVersion is provided", () => {
    moduleConfig.appVersion = undefined;
    const assets = new Assets(moduleConfig, "/tmp", ["secret1", "secret2"], "localhost");
    assets.capabilities = [];
    const zarfChart = parseYAMLToJSON(
      generateZarfYamlGeneric(assets, "pepr-module-static-test.yaml", "charts"),
    )![0];
    expect(zarfChart.metadata!.version).toBe("0.0.1");
    expect(zarfChart.components[0].charts![0].version).toBe("0.0.1");
  });
});
interface ZarfPackageConfig {
  kind: string;
  metadata: {
    name: string;
    description: string;
    url: string;
    version: string;
  };
  components: {
    name: string;
    required: boolean;
    images: string[];
    manifests?: {
      name: string;
      namespace: string;
      files: string[];
    }[];
    charts?: {
      name: string;
      namespace: string;
      version: string;
      localPath: string;
    }[];
  }[];
}

function parseYAMLToJSON(yamlContent: string): ZarfPackageConfig[] {
  return loadAllYaml(yamlContent);
}
