// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it, vi, type Mock, beforeEach } from "vitest";
import { promises as fs } from "fs";
import { overridesFile, writeSchemaYamlFromObject } from "./overridesFile";
import type { ChartOverrides } from "./overridesFile";
import { load as loadYaml } from "js-yaml";
import { ModuleConfig } from "../../types";
import { V1PolicyRule } from "@kubernetes/client-node";
import type { JSONSchema7 } from "json-schema";

vi.mock("fs", async () => {
  const actualFs = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actualFs,
    promises: {
      readFile: vi.fn<() => Promise<string>>().mockResolvedValue("mocked"),
      writeFile: vi.fn(),
      access: vi.fn(),
    },
  };
});

interface OverridesFileSchema {
  imagePullSecrets: string[];
  additionalIgnoredNamespaces: string[];
  rbac: V1PolicyRule[];
  image: string;
  secrets: {
    apiPath: string;
  };
  hash: string;
  namespace: {
    annotations: {
      [key: string]: string;
    };
    labels: {
      [key: string]: string;
    };
  };
  uuid: string;
  admission: {
    enabled: boolean;
    antiAffinity: boolean;
    terminationGracePeriodSeconds: number;
    failurePolicy: string;
    annotations: {
      "pepr.dev/description": string;
    };
    image: string;
    labels: {
      [key: string]: string;
    };
    securityContext: {
      runAsUser: number;
      runAsGroup: number;
      runAsNonRoot: true;
      fsGroup: number;
    };
  };
  watcher: {
    enabled: boolean;
    terminationGracePeriodSeconds: number;
    failurePolicy: string;
    annotations: {
      "pepr.dev/description": string;
    };
    image: string;
    labels: {
      [key: string]: string;
    };
  };
}

describe("overridesFile", () => {
  const mockPath = "/tmp/overrides.yaml";
  const imagePullSecrets = ["secret1", "secret2"];
  const config: ModuleConfig = {
    uuid: "12345",
    alwaysIgnore: {
      namespaces: [],
    },
    onError: "reject",
    webhookTimeout: 10,
    description: "Test Module",
    customLabels: {},
    rbacMode: "namespace",
    rbac: [],
  };

  const mockOverrides: ChartOverrides = {
    apiPath: "/some/api",
    capabilities: [],
    config,
    hash: "test-hash",
    name: "test-module",
    image: "test-image",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("writes a valid YAML file with expected contents", async () => {
    await overridesFile(mockOverrides, mockPath, imagePullSecrets);

    expect(fs.writeFile).toHaveBeenCalledTimes(2);
    const calls = (fs.writeFile as Mock).mock.calls;
    const yamlCall = calls.find(([path]) => path === mockPath);

    expect(yamlCall).toBeDefined();

    const [writtenPath, writtenContent] = yamlCall!;
    expect(writtenPath).toBe(mockPath);
    const parsedYaml = loadYaml(writtenContent as string) as OverridesFileSchema;

    expect(parsedYaml.imagePullSecrets).toEqual(["secret1", "secret2"]);
    expect(parsedYaml.hash).toBe(mockOverrides.hash);
    expect(parsedYaml.admission.image).toBe(mockOverrides.image);
    expect(parsedYaml.admission.antiAffinity).toBe(false);
    expect(parsedYaml.admission.failurePolicy).toBe("Fail");
    expect(parsedYaml.watcher.image).toBe(mockOverrides.image);
    expect(parsedYaml.secrets.apiPath).toBe(Buffer.from(mockOverrides.apiPath).toString("base64"));
    expect(parsedYaml.admission.annotations["pepr.dev/description"]).toBe(
      mockOverrides.config.description,
    );
    expect(parsedYaml.admission.securityContext.runAsUser).toBe(65532);
    expect(parsedYaml.admission.securityContext.runAsGroup).toBe(65532);
    expect(parsedYaml.admission.securityContext.fsGroup).toBe(65532);
    expect(parsedYaml.admission.securityContext.runAsNonRoot).toBeTruthy();
  });

  it("sets correct webhook failurePolicy based on config", async () => {
    mockOverrides.config.onError = "ignore";
    await overridesFile(mockOverrides, mockPath, imagePullSecrets);

    expect(fs.writeFile).toHaveBeenCalledTimes(2);

    const calls = (fs.writeFile as Mock).mock.calls;
    const yamlCall = calls.find(([path]) => path === mockPath);

    expect(yamlCall).toBeDefined();

    const [writtenPath, writtenContent] = yamlCall!;
    expect(writtenPath).toBe(mockPath);

    const parsedYaml = loadYaml(writtenContent as string) as OverridesFileSchema;

    expect(parsedYaml.admission.failurePolicy).toBe("Ignore");
  });

  it("sets correct podSecurityContext for private images", async () => {
    mockOverrides.image += "-private";
    await overridesFile(mockOverrides, mockPath, imagePullSecrets);

    expect(fs.writeFile).toHaveBeenCalledTimes(2);

    const calls = (fs.writeFile as Mock).mock.calls;
    const yamlCall = calls.find(([path]) => path === mockPath);

    expect(yamlCall).toBeDefined();

    const [writtenPath, writtenContent] = yamlCall!;
    expect(writtenPath).toBe(mockPath);

    const parsedYaml = loadYaml(writtenContent as string) as OverridesFileSchema;

    expect(parsedYaml.admission.securityContext.runAsUser).toBe(1000);
    expect(parsedYaml.admission.securityContext.runAsGroup).toBe(1000);
    expect(parsedYaml.admission.securityContext.fsGroup).toBe(1000);
  });

  it.each([
    ["", ""],
    [undefined, ""],
    ["myDescription", "myDescription"],
  ])("sets correct annotations based on config - given %j, sets %j", async (given, expected) => {
    mockOverrides.config.description = given;
    await overridesFile(mockOverrides, mockPath, imagePullSecrets);

    expect(fs.writeFile).toHaveBeenCalledTimes(2);

    const calls = (fs.writeFile as Mock).mock.calls;
    const yamlCall = calls.find(([path]) => path === mockPath);

    expect(yamlCall).toBeDefined();

    const [writtenPath, writtenContent] = yamlCall!;
    expect(writtenPath).toBe(mockPath);

    const parsedYaml = loadYaml(writtenContent as string) as OverridesFileSchema;

    expect(parsedYaml.admission.annotations["pepr.dev/description"]).toBe(expected);
    expect(parsedYaml.watcher.annotations["pepr.dev/description"]).toBe(expected);
  });

  it("properly encodes apiPath in base64", async () => {
    await overridesFile(mockOverrides, mockPath, imagePullSecrets);

    const [, [, writtenContent]] = (fs.writeFile as Mock).mock.calls;
    const parsedYaml = loadYaml(writtenContent as string) as OverridesFileSchema;

    expect(parsedYaml.secrets.apiPath).toBe(Buffer.from(mockOverrides.apiPath).toString("base64"));
  });

  it("sets admission and watcher to enabled by default", async () => {
    await overridesFile(mockOverrides, mockPath, imagePullSecrets);

    const calls = (fs.writeFile as Mock).mock.calls;
    const writtenYaml = calls.find(([path]) => path.endsWith("overrides.yaml"))?.[1];
    const parsedYaml = loadYaml(writtenYaml as string) as OverridesFileSchema;

    expect(parsedYaml.admission.enabled).toBe(true);
    expect(parsedYaml.watcher.enabled).toBe(true);
  });

  it("sets admission.enabled to true and watcher.enabled to false based on args", async () => {
    await overridesFile(mockOverrides, mockPath, imagePullSecrets, {
      admission: true,
      watcher: false,
    });

    const calls = (fs.writeFile as Mock).mock.calls;
    const writtenYaml = calls.find(([path]) => path.endsWith("overrides.yaml"))?.[1];
    const parsedYaml = loadYaml(writtenYaml as string) as OverridesFileSchema;

    expect(parsedYaml.admission.enabled).toBe(true);
    expect(parsedYaml.watcher.enabled).toBe(false);
  });

  it("sets admission.enabled to false and watcher.enabled to true based on args", async () => {
    await overridesFile(mockOverrides, mockPath, imagePullSecrets, {
      admission: false,
      watcher: true,
    });

    const calls = (fs.writeFile as Mock).mock.calls;
    const yamlCall = calls.find(([path]) => path === mockPath);

    expect(yamlCall).toBeDefined();

    const [, writtenContent] = yamlCall!;
    const parsedYaml = loadYaml(writtenContent as string) as OverridesFileSchema;

    expect(parsedYaml.admission.enabled).toBe(false);
    expect(parsedYaml.watcher.enabled).toBe(true);
  });

  it("writes a valid schema.json alongside values.yaml", async () => {
    const valuesString = JSON.stringify(
      {
        name: "test",
        version: 1,
        features: {
          enabled: true,
        },
      },
      null,
      2,
    );

    const valuesFilePath = "/tmp/values.yaml";
    const expectedSchemaPath = "/tmp/values.schema.json";

    await writeSchemaYamlFromObject(valuesString, valuesFilePath);

    const jsonCall = (fs.writeFile as Mock).mock.calls.find(
      ([path]) => path === expectedSchemaPath,
    );

    expect(jsonCall).toBeDefined();

    const [, writtenSchema] = jsonCall!;
    expect(typeof writtenSchema).toBe("string");

    const parsedSchema = JSON.parse(writtenSchema as string) as JSONSchema7;

    // Validate root structure
    expect(parsedSchema.$ref).toBe("#/definitions/Values");

    // Validate Values definition
    const valuesDef = parsedSchema.definitions?.Values as JSONSchema7;
    expect(valuesDef).toMatchObject({
      type: "object",
      properties: {
        name: { type: "string" },
        version: { type: "integer" },
        features: {
          $ref: "#/definitions/Features",
        },
      },
    });

    expect(valuesDef.required).toEqual(expect.arrayContaining(["name", "version", "features"]));
    expect(valuesDef.required).toHaveLength(3);

    const featuresDef = parsedSchema.definitions?.Features as JSONSchema7;
    expect(featuresDef).toMatchObject({
      type: "object",
      properties: {
        enabled: { type: "boolean" },
      },
    });

    expect(featuresDef.required).toEqual(expect.arrayContaining(["enabled"]));
    expect(featuresDef.required).toHaveLength(1);
  });
  it("uses alwaysIgnore.namespaces when non-empty", async () => {
    const cfgWithAlwaysIgnore = {
      ...mockOverrides,
      config: {
        ...mockOverrides.config,
        alwaysIgnore: {
          namespaces: ["ns1", "ns2"],
        },
      },
    };

    await overridesFile(cfgWithAlwaysIgnore, mockPath, imagePullSecrets);

    const calls = (fs.writeFile as Mock).mock.calls;
    const yamlCall = calls.find(([path]) => path === mockPath);
    const [, writtenContent] = yamlCall!;
    const parsedYaml = loadYaml(writtenContent as string) as OverridesFileSchema;

    expect(parsedYaml.additionalIgnoredNamespaces).toEqual(["ns1", "ns2"]);
  });
  it("falls back to admission.alwaysIgnore.namespaces when alwaysIgnore is empty", async () => {
    const cfgWithAdmissionIgnore = {
      ...mockOverrides,
      config: {
        ...mockOverrides.config,
        alwaysIgnore: { namespaces: [] },
        admission: { alwaysIgnore: { namespaces: ["nsA", "nsB"] } },
      },
    };

    await overridesFile(cfgWithAdmissionIgnore, mockPath, imagePullSecrets);

    const calls = (fs.writeFile as Mock).mock.calls;
    const yamlCall = calls.find(([path]) => path === mockPath);
    const [, writtenContent] = yamlCall!;
    const parsedYaml = loadYaml(writtenContent as string) as OverridesFileSchema;

    expect(parsedYaml.additionalIgnoredNamespaces).toEqual(["nsA", "nsB"]);
  });
});
