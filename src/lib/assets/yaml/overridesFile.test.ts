// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it, jest, beforeEach } from "@jest/globals";
import { promises as fs } from "fs";
import { overridesFile } from "./overridesFile";
import type { ChartOverrides } from "./overridesFile";
import { load as loadYaml } from "js-yaml";
import { ModuleConfig } from "../../types";
import { V1PolicyRule } from "@kubernetes/client-node";

jest.mock("fs", () => ({
  ...(jest.requireActual("fs") as object),
  promises: {
    readFile: jest.fn<() => Promise<string>>().mockResolvedValue("mocked"),
    writeFile: jest.fn(),
    access: jest.fn(),
  },
}));

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
    jest.clearAllMocks();
  });
  it("writes a valid YAML file with expected contents", async () => {
    await overridesFile(mockOverrides, mockPath, imagePullSecrets);

    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    const [[writtenPath, writtenContent]] = (fs.writeFile as jest.Mock).mock.calls;

    expect(writtenPath).toBe(mockPath);

    const parsedYaml = loadYaml(writtenContent as string) as OverridesFileSchema;
    expect(parsedYaml.imagePullSecrets).toEqual(["secret1", "secret2"]);
    expect(parsedYaml.hash).toBe(mockOverrides.hash);
    expect(parsedYaml.admission.image).toBe(mockOverrides.image);
    expect(parsedYaml.admission.failurePolicy).toBe("Fail");
    expect(parsedYaml.watcher.image).toBe(mockOverrides.image);
    expect(parsedYaml.secrets.apiPath).toBe(Buffer.from(mockOverrides.apiPath).toString("base64"));
    expect(parsedYaml.admission.annotations["pepr.dev/description"]).toBe(mockOverrides.config.description);
  });

  it("sets correct webhook failurePolicy based on config", async () => {
    mockOverrides.config.onError = "ignore";
    await overridesFile(mockOverrides, mockPath, imagePullSecrets);

    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    const [[writtenPath, writtenContent]] = (fs.writeFile as jest.Mock).mock.calls;

    expect(writtenPath).toBe(mockPath);

    const parsedYaml = loadYaml(writtenContent as string) as OverridesFileSchema;

    expect(parsedYaml.admission.failurePolicy).toBe("Ignore");
  });

  it("sets correct annotations based on config", async () => {
    mockOverrides.config.description = "";
    await overridesFile(mockOverrides, mockPath, imagePullSecrets);

    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    const [[writtenPath, writtenContent]] = (fs.writeFile as jest.Mock).mock.calls;

    expect(writtenPath).toBe(mockPath);

    const parsedYaml = loadYaml(writtenContent as string) as OverridesFileSchema;

    expect(parsedYaml.admission.annotations["pepr.dev/description"]).toBe("");
    expect(parsedYaml.watcher.annotations["pepr.dev/description"]).toBe("");
  });
  it("properly encodes apiPath in base64", async () => {
    await overridesFile(mockOverrides, mockPath, imagePullSecrets);

    const [[, writtenContent]] = (fs.writeFile as jest.Mock).mock.calls;
    const parsedYaml = loadYaml(writtenContent as string) as OverridesFileSchema;

    expect(parsedYaml.secrets.apiPath).toBe(Buffer.from(mockOverrides.apiPath).toString("base64"));
  });
});
