// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it, vi, type Mock, beforeEach } from "vitest";
import { promises as fs } from "fs";
import { overridesFile, writeSchemaYamlFromObject, fixSchemaForFlexibleMaps } from "./overridesFile";
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

  it("generates schema with additionalProperties:true for flexible map fields", async () => {
    const valuesString = JSON.stringify(
      {
        admission: {
          enabled: true,
          podLabels: { "custom-label": "custom-value" },
          podAnnotations: { "custom-annotation": "custom-value" },
          nodeSelector: { "node-type": "worker" },
          affinity: {},
          serviceMonitor: {
            enabled: false,
            labels: { "monitoring": "prometheus" },
            annotations: { "prometheus.io/scrape": "true" }
          }
        },
        watcher: {
          enabled: true,
          podLabels: { "watcher-label": "value" },
          podAnnotations: {},
          nodeSelector: {},
          affinity: {},
          serviceMonitor: {
            enabled: false,
            labels: {},
            annotations: {}
          }
        },
        namespace: {
          annotations: { "namespace-annotation": "value" },
          labels: { "namespace-label": "value" }
        }
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
    const parsedSchema = JSON.parse(writtenSchema as string) as JSONSchema7;

    const affinityDef = parsedSchema.definitions?.Affinity as JSONSchema7;
    expect(affinityDef).toBeDefined();
    expect(affinityDef.additionalProperties).toBe(true);
    expect(affinityDef.type).toBe("object");
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

describe("fixSchemaForFlexibleMaps", () => {
  it("should allow additional properties for known flexible map definitions", () => {
    const schema = {
      definitions: {
        Affinity: {
          type: "object",
          additionalProperties: false,
          title: "Affinity",
          properties: {},
        },
        OtherType: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
          },
        },
      },
    };

    fixSchemaForFlexibleMaps(schema);

    expect(schema.definitions.Affinity.additionalProperties).toBe(true);
    expect(schema.definitions.Affinity.title).toBeUndefined();
    expect(schema.definitions.OtherType.additionalProperties).toBe(false);
  });

  it("should allow additional properties for empty object definitions", () => {
    const schema = {
      definitions: {
        EmptyObject: {
          type: "object",
          additionalProperties: false,
          title: "EmptyObject",
        },
        ObjectWithProperties: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
          },
        },
        NonObject: {
          type: "string",
          additionalProperties: false,
        },
      },
    };

    fixSchemaForFlexibleMaps(schema);

    expect(schema.definitions.EmptyObject.additionalProperties).toBe(true);
    expect(schema.definitions.EmptyObject.title).toBeUndefined();
    expect(schema.definitions.ObjectWithProperties.additionalProperties).toBe(false);
    expect(schema.definitions.NonObject.additionalProperties).toBe(false);
  });

  it("should handle objects with empty properties object", () => {
    const schema = {
      definitions: {
        EmptyPropsObject: {
          type: "object",
          additionalProperties: false,
          title: "EmptyPropsObject",
          properties: {},
        },
      },
    };

    fixSchemaForFlexibleMaps(schema);

    expect(schema.definitions.EmptyPropsObject.additionalProperties).toBe(true);
    expect(schema.definitions.EmptyPropsObject.title).toBeUndefined();
  });

  it("should not modify definitions that already allow additional properties", () => {
    const schema = {
      definitions: {
        FlexibleObject: {
          type: "object",
          additionalProperties: true,
          properties: {},
        },
      },
    };

    fixSchemaForFlexibleMaps(schema);

    expect(schema.definitions.FlexibleObject.additionalProperties).toBe(true);
  });

  it("should preserve title if it differs from definition name", () => {
    const schema = {
      definitions: {
        MyObject: {
          type: "object",
          additionalProperties: false,
          title: "CustomTitle",
          properties: {},
        },
      },
    };

    fixSchemaForFlexibleMaps(schema);

    expect(schema.definitions.MyObject.additionalProperties).toBe(true);
    expect(schema.definitions.MyObject.title).toBe("CustomTitle");
  });

  it("should handle schema without definitions", () => {
    const schema = {
      type: "object",
      properties: {},
    };

    expect(() => fixSchemaForFlexibleMaps(schema)).not.toThrow();
  });

  it("should handle empty schema", () => {
    const schema = {};

    expect(() => fixSchemaForFlexibleMaps(schema)).not.toThrow();
  });

  it("should handle multiple known flexible map definitions", () => {
    const schema = {
      definitions: {
        Affinity: {
          type: "object",
          additionalProperties: false,
          title: "Affinity",
          properties: {},
        },
        UnknownFlexibleMap: {
          type: "object",
          additionalProperties: false,
          title: "UnknownFlexibleMap",
          properties: {},
        },
      },
    };

    fixSchemaForFlexibleMaps(schema);

    expect(schema.definitions.Affinity.additionalProperties).toBe(true);
    expect(schema.definitions.UnknownFlexibleMap.additionalProperties).toBe(true);
  });

  it("should handle complex nested schema structure", () => {
    const schema = {
      $schema: "http://json-schema.org/draft-06/schema#",
      definitions: {
        Values: {
          type: "object",
          additionalProperties: false,
          properties: {
            admission: {
              $ref: "#/definitions/Admission",
            },
          },
        },
        Admission: {
          type: "object",
          additionalProperties: false,
          properties: {
            podLabels: {
              $ref: "#/definitions/Affinity",
            },
            nodeSelector: {
              $ref: "#/definitions/Affinity",
            },
          },
        },
        Affinity: {
          type: "object",
          additionalProperties: false,
          title: "Affinity",
        },
      },
    };

    fixSchemaForFlexibleMaps(schema);

    expect(schema.definitions.Affinity.additionalProperties).toBe(true);
    expect(schema.definitions.Affinity.title).toBeUndefined();
    expect(schema.definitions.Values.additionalProperties).toBe(false);
    expect(schema.definitions.Admission.additionalProperties).toBe(false);
  });

  it("should handle schema validation scenario from real world usage", () => {
    const schema = {
      $schema: "http://json-schema.org/draft-06/schema#",
      $ref: "#/definitions/Values",
      definitions: {
        Values: {
          type: "object",
          additionalProperties: false,
          properties: {
            admission: {
              $ref: "#/definitions/Admission",
            },
            watcher: {
              $ref: "#/definitions/Admission",
            },
          },
        },
        Admission: {
          type: "object",
          additionalProperties: false,
          properties: {
            podAnnotations: {
              $ref: "#/definitions/Affinity",
            },
            podLabels: {
              $ref: "#/definitions/Affinity",
            },
            nodeSelector: {
              $ref: "#/definitions/Affinity",
            },
            affinity: {
              $ref: "#/definitions/Affinity",
            },
          },
        },
        Affinity: {
          type: "object",
          additionalProperties: false,
          title: "Affinity",
        },
      },
    };

    fixSchemaForFlexibleMaps(schema);
    expect(schema.definitions.Affinity.additionalProperties).toBe(true);
    expect(schema.definitions.Affinity.title).toBeUndefined();
    
    expect(schema.definitions.Values.additionalProperties).toBe(false);
    expect(schema.definitions.Admission.additionalProperties).toBe(false);
  });
});
