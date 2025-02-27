// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { ModuleConfig } from "../types";
import { Assets } from "./assets";
import { expect, describe, it, jest, afterAll } from "@jest/globals";
import { CapabilityExport } from "../types";
import { kind } from "kubernetes-fluent-client";
import { createDirectoryIfNotExists } from "../filesystemService";
import { promises as fs } from "fs";
import {
  V1Deployment,
  V1MutatingWebhookConfiguration,
  V1Secret,
  V1ValidatingWebhookConfiguration,
} from "@kubernetes/client-node/dist/gen";
import { WebhookType } from "../enums";
import { helmLayout } from "./index";

jest.mock("../filesystemService", () => ({
  createDirectoryIfNotExists: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));
jest.mock("./yaml/overridesFile", () => ({
  overridesFile: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));
jest.mock("fs", () => ({
  ...(jest.requireActual("fs") as object),
  promises: {
    readFile: jest.fn<() => Promise<string>>().mockResolvedValue("mocked"),
    writeFile: jest.fn(),
    access: jest.fn(),
  },
}));

jest.mock("./loader", () => ({
  loadCapabilities: jest.fn<() => Promise<CapabilityExport[]>>().mockResolvedValue([
    {
      name: "capability-1",
      description: "A test capability",
      namespaces: ["custom-ns", "custom-two"],
      bindings: [],
      hasSchedule: false,
    },
  ]),
}));

jest.mock("./pods", () => ({
  getWatcher: jest.fn<() => V1Deployment>().mockReturnValue({
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name: `test-module-watcher`,
      namespace: "pepr-system",
    },
    spec: {
      replicas: 1,
      selector: {
        matchLabels: {
          app: "test-module-watcher",
        },
      },
      template: {
        metadata: {
          labels: {
            app: "test-module-watcher",
          },
        },
        spec: {
          containers: [
            {
              name: "test-module-watcher",
              image: "test-image",
              ports: [
                {
                  containerPort: 8080,
                },
              ],
            },
          ],
        },
      },
    },
  }),
  getModuleSecret: jest.fn<() => V1Secret>().mockReturnValue({
    apiVersion: "v1",
    kind: "Secret",
    metadata: {
      name: `test-module`,
      namespace: "pepr-system",
    },
    type: "Opaque",
    data: {
      "module-hash.js.gz": "aGVsbG8=",
    },
  }),
  getDeployment: jest.fn<() => V1Deployment>().mockReturnValue({
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name: `test-module`,
      namespace: "pepr-system",
    },
    spec: {
      replicas: 1,
      selector: {
        matchLabels: {
          app: "test-module",
        },
      },
      template: {
        metadata: {
          labels: {
            app: "test-module",
          },
        },
        spec: {
          containers: [
            {
              name: "test-module",
              image: "test-image",
              ports: [
                {
                  containerPort: 8080,
                },
              ],
            },
          ],
        },
      },
    },
  }),
}));

jest.mock("./index", () => ({
  toYaml: jest.fn<() => string>().mockReturnValue("mocked-yaml"),
  helmLayout: jest.fn(() => ({
    files: {
      chartYaml: "/tmp/chart.yaml",
      namespaceYaml: "/tmp/namespace.yaml",
      watcherServiceYaml: "/tmp/watcher-service.yaml",
      admissionServiceYaml: "/tmp/admission-service.yaml",
      tlsSecretYaml: "/tmp/tls-secret.yaml",
      apiPathSecretYaml: "/tmp/api-path-secret.yaml",
      storeRoleYaml: "/tmp/store-role.yaml",
      storeRoleBindingYaml: "/tmp/store-role-binding.yaml",
      clusterRoleYaml: "/tmp/cluster-role.yaml",
      clusterRoleBindingYaml: "/tmp/cluster-role-binding.yaml",
      serviceAccountYaml: "/tmp/service-account.yaml",
      moduleSecretYaml: "/tmp/module-secret.yaml",
      valuesYaml: "/tmp/values.yaml",
      watcherDeploymentYaml: "/tmp/watcher-deployment.yaml",
      watcherServiceMonitorYaml: "/tmp/watcher-service-monitor.yaml",
    },
    dirs: {
      templates: "/tmp/templates",
      charts: "/tmp/charts",
    },
  })),
  createWebhookYaml: jest.fn(
    (
      name: string,
      config: ModuleConfig,
      webhook: kind.MutatingWebhookConfiguration | kind.ValidatingWebhookConfiguration,
    ) => `mocked-yaml-${name}-${webhook ? "ok" : config.webhookTimeout}`,
  ),
}));

describe("Assets", () => {
  const moduleConfig: ModuleConfig = {
    uuid: "test-uuid",
    alwaysIgnore: {
      namespaces: ["zarf"],
    },
    peprVersion: "0.0.1",
    appVersion: "0.0.1",
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

  afterAll(() => {
    jest.clearAllMocks();
  });

  it("should call deploy function that calls deployFunction with assets, force and webhookTimeout", async () => {
    const deployFunction = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    await assets.deploy(deployFunction, true, assets.config.webhookTimeout);

    expect(deployFunction).toHaveBeenCalledWith(assets, true, assets.config.webhookTimeout);
    expect(deployFunction).toHaveBeenCalledTimes(1);
  });

  it("should call zarfYaml that calls zarfYamlGenerator with assets, path, and manifests type", () => {
    const zarfYamlGenerator = jest.fn<() => string>().mockReturnValue("");
    assets.zarfYaml(zarfYamlGenerator, "/tmp");

    expect(zarfYamlGenerator).toHaveBeenCalledWith(assets, "/tmp", "manifests");
    expect(zarfYamlGenerator).toHaveBeenCalledTimes(1);
  });

  it("should call zarfYamlChart that calls zarfYamlGenerator with assets, path, and charts type", () => {
    const zarfYamlGenerator = jest.fn<() => string>().mockReturnValue("");
    assets.zarfYamlChart(zarfYamlGenerator, "/tmp");

    expect(zarfYamlGenerator).toHaveBeenCalledWith(assets, "/tmp", "charts");
    expect(zarfYamlGenerator).toHaveBeenCalledTimes(1);
  });

  it("should call allYaml that calls yamlGenerationFunction with assets deployments", async () => {
    const yamlGenerationFunction = jest.fn<() => Promise<string>>().mockResolvedValue("");
    await assets.allYaml(yamlGenerationFunction);
    const expectedDeployments = {
      default: expect.any(Object),
      watch: expect.any(Object),
    };
    expect(yamlGenerationFunction).toHaveBeenCalledTimes(1);
    expect(yamlGenerationFunction).toHaveBeenCalledWith(assets, expectedDeployments);
  });

  it("should call writeWebhookFiles and write admissionController Deployment, ServiceMonitor, and WebhookConfigs", async () => {
    const mockHelm = {
      files: {
        admissionDeploymentYaml: "/tmp/admission-deployment.yaml",
        admissionServiceMonitorYaml: "/tmp/admission-service-monitor.yaml",
        mutationWebhookYaml: "/tmp/mutation-webhook.yaml",
        validationWebhookYaml: "/tmp/validation-webhook.yaml",
      },
    };
    const validateWebhook: V1ValidatingWebhookConfiguration = new kind.ValidatingWebhookConfiguration();
    const mutateWebhook: V1MutatingWebhookConfiguration = new kind.MutatingWebhookConfiguration();
    await assets.writeWebhookFiles(validateWebhook, mutateWebhook, mockHelm);

    expect(fs.writeFile).toHaveBeenCalledTimes(4);
  });

  it("should call generateHelmChart which should call createDirectoryIfNotExists twice for templates and charts", async () => {
    const webhookGeneratorFunction = jest
      .fn<() => Promise<V1MutatingWebhookConfiguration | V1ValidatingWebhookConfiguration | null>>()
      .mockResolvedValue(new kind.MutatingWebhookConfiguration());
    await assets.generateHelmChart(webhookGeneratorFunction, "/tmp");
    expect(createDirectoryIfNotExists).toHaveBeenCalledTimes(2);
  });

  it("should call generateHelmChart which should write file 40 times for built Kubernetes Manifests and helm chart generation", async () => {
    const webhookGeneratorFunction = jest
      .fn<() => Promise<V1MutatingWebhookConfiguration | V1ValidatingWebhookConfiguration | null>>()
      .mockResolvedValue(new kind.MutatingWebhookConfiguration());
    await assets.generateHelmChart(webhookGeneratorFunction, "/tmp");
    expect(fs.writeFile).toHaveBeenCalledTimes(40);
  });

  it("should call generateHelmChart and get no error", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const webhookGeneratorFunction = jest
      .fn<() => Promise<V1MutatingWebhookConfiguration | V1ValidatingWebhookConfiguration | null>>()
      .mockResolvedValue(new kind.MutatingWebhookConfiguration());
    await assets.generateHelmChart(webhookGeneratorFunction, "/tmp");
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("should call generateHelmChart without an error when asset class instance is correct", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const webhookGeneratorFunction = jest
      .fn<() => Promise<V1MutatingWebhookConfiguration | V1ValidatingWebhookConfiguration | null>>()
      .mockResolvedValue(new kind.MutatingWebhookConfiguration());
    await assets.generateHelmChart(webhookGeneratorFunction, "/tmp");
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("should call generateHelmChart and throw an error when config is incorrect", async () => {
    const exitString = "Mock console.exit call";
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const processExitSpy = jest.spyOn(process, "exit").mockImplementation(() => {
      throw new Error(exitString);
    });

    (helmLayout as jest.Mock).mockReturnValue(null);

    const webhookGeneratorFunction = jest
      .fn<
        (
          assets: Assets,
          mutateOrValidate: WebhookType,
          timeoutSeconds: number | undefined,
        ) => Promise<V1MutatingWebhookConfiguration | V1ValidatingWebhookConfiguration | null>
      >()
      .mockResolvedValue(new kind.ValidatingWebhookConfiguration());

    await expect(assets.generateHelmChart(webhookGeneratorFunction, "/tmp")).rejects.toThrow(exitString);

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
