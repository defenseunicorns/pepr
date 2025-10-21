// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it, vi, type Mock, beforeEach } from "vitest";
import { promises as fs } from "fs";
import {
  overridesFile,
  writeSchemaYamlFromObject,
  runIdsForImage,
  commonProbes,
  podSecurityContext,
  controllerAnnotations,
  namespaceBlock,
  commonResources,
  controllerLabels,
  containerSecurityContext,
} from "./overridesFile";
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

  it("sets correct annotations based on config", async () => {
    mockOverrides.config.description = "";
    await overridesFile(mockOverrides, mockPath, imagePullSecrets);

    expect(fs.writeFile).toHaveBeenCalledTimes(2);

    const calls = (fs.writeFile as Mock).mock.calls;
    const yamlCall = calls.find(([path]) => path === mockPath);

    expect(yamlCall).toBeDefined();

    const [writtenPath, writtenContent] = yamlCall!;
    expect(writtenPath).toBe(mockPath);

    const parsedYaml = loadYaml(writtenContent as string) as OverridesFileSchema;

    expect(parsedYaml.admission.annotations["pepr.dev/description"]).toBe("");
    expect(parsedYaml.watcher.annotations["pepr.dev/description"]).toBe("");
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
});

describe("overrides helpers", () => {
  describe("runIdsForImage", () => {
    it("returns 1000 uid/gid/fsGroup for images containing 'private'", () => {
      const ids = runIdsForImage("ghcr.io/org/private-controller:1.2.3");
      expect(ids).toEqual({ uid: 1000, gid: 1000, fsGroup: 1000 });
    });

    it("returns 65532 uid/gid/fsGroup for non-private images", () => {
      const ids = runIdsForImage("ghcr.io/org/controller:1.2.3");
      expect(ids).toEqual({ uid: 65532, gid: 65532, fsGroup: 65532 });
    });
  });

  describe("commonProbes", () => {
    it("returns HTTPS /healthz probes on port 3000 with 10s initial delay", () => {
      const probes = commonProbes();
      expect(probes).toEqual({
        readinessProbe: {
          httpGet: { path: "/healthz", port: 3000, scheme: "HTTPS" },
          initialDelaySeconds: 10,
        },
        livenessProbe: {
          httpGet: { path: "/healthz", port: 3000, scheme: "HTTPS" },
          initialDelaySeconds: 10,
        },
      });
    });
  });

  describe("commonResources", () => {
    it("returns expected CPU/memory requests and limits", () => {
      const res = commonResources();
      expect(res).toEqual({
        requests: { memory: "256Mi", cpu: "200m" },
        limits: { memory: "512Mi", cpu: "500m" },
      });
    });
  });

  describe("podSecurityContext", () => {
    it("maps ids from runIdsForImage for non-private images", () => {
      const ctx = podSecurityContext("repo/controller:latest");
      expect(ctx).toEqual({
        runAsUser: 65532,
        runAsGroup: 65532,
        runAsNonRoot: true,
        fsGroup: 65532,
      });
    });

    it("maps ids from runIdsForImage for private images", () => {
      const ctx = podSecurityContext("repo/private-controller:latest");
      expect(ctx).toEqual({
        runAsUser: 1000,
        runAsGroup: 1000,
        runAsNonRoot: true,
        fsGroup: 1000,
      });
    });
  });

  describe("containerSecurityContext", () => {
    it("returns non-root, no-priv-esc, drop ALL caps for non-private images", () => {
      const ctx = containerSecurityContext("repo/controller:latest");
      expect(ctx).toEqual({
        runAsUser: 65532,
        runAsGroup: 65532,
        runAsNonRoot: true,
        allowPrivilegeEscalation: false,
        capabilities: { drop: ["ALL"] },
      });
    });

    it("returns non-root, no-priv-esc, drop ALL caps for private images with user 1000", () => {
      const ctx = containerSecurityContext("repo/private-controller:latest");
      expect(ctx).toEqual({
        runAsUser: 1000,
        runAsGroup: 1000,
        runAsNonRoot: true,
        allowPrivilegeEscalation: false,
        capabilities: { drop: ["ALL"] },
      });
    });
  });

  describe("controllerLabels", () => {
    it("sets app to name for admission", () => {
      const labels = controllerLabels("pepr", "uuid-123", "admission");
      expect(labels).toEqual({
        app: "pepr",
        "pepr.dev/controller": "admission",
        "pepr.dev/uuid": "uuid-123",
      });
    });

    it("sets app to name-watcher for watcher", () => {
      const labels = controllerLabels("pepr", "uuid-123", "watcher");
      expect(labels).toEqual({
        app: "pepr-watcher",
        "pepr.dev/controller": "watcher",
        "pepr.dev/uuid": "uuid-123",
      });
    });
  });

  describe("controllerAnnotations", () => {
    it("includes description when provided", () => {
      expect(controllerAnnotations("hello")).toEqual({ "pepr.dev/description": "hello" });
    });

    it("falls back to empty string when description is undefined", () => {
      expect(controllerAnnotations()).toEqual({ "pepr.dev/description": "" });
    });
  });

  describe("namespaceBlock", () => {
    it("returns default label when no custom namespace labels are provided", () => {
      const cfg = { customLabels: undefined } as unknown as ModuleConfig;
      const ns = namespaceBlock(cfg);
      expect(ns).toEqual({ annotations: {}, labels: { "pepr.dev": "" } });
    });

    it("returns provided custom namespace labels when present", () => {
      const cfg = {
        customLabels: { namespace: { "pepr.dev/custom": "x", team: "unicorns" } },
      } as unknown as ModuleConfig;
      const ns = namespaceBlock(cfg);
      expect(ns).toEqual({
        annotations: {},
        labels: { "pepr.dev/custom": "x", team: "unicorns" },
      });
    });
  });
});
