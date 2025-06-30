// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { ModuleConfig, CapabilityExport, Binding } from "../types";
import { Assets, isAdmission, isWatcher } from "./assets";
import { expect, describe, it, vi, beforeEach, afterEach, afterAll, type Mock } from "vitest";
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

vi.mock("../filesystemService", () => ({
  createDirectoryIfNotExists: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));
vi.mock("./yaml/overridesFile", () => ({
  overridesFile: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

vi.mock("fs", async () => {
  const actualFs = await vi.importActual<typeof import("fs")>("fs");

  return {
    ...actualFs,
    promises: {
      ...actualFs.promises,
      readFile: vi.fn().mockResolvedValue("mocked"),
      writeFile: vi.fn(),
      access: vi.fn(),
    },
  };
});

vi.mock("./loader", () => ({
  loadCapabilities: vi.fn<() => Promise<CapabilityExport[]>>().mockResolvedValue([
    {
      name: "capability-1",
      description: "A test capability",
      namespaces: ["custom-ns", "custom-two"],
      bindings: [],
      hasSchedule: false,
    },
  ]),
}));

vi.mock("./pods", () => ({
  getWatcher: vi.fn<() => V1Deployment>().mockReturnValue({
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
  getModuleSecret: vi.fn<() => V1Secret>().mockReturnValue({
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
  getDeployment: vi.fn<() => V1Deployment>().mockReturnValue({
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

vi.mock("./index", () => ({
  toYaml: vi.fn<() => string>().mockReturnValue("mocked-yaml"),
  helmLayout: vi.fn(() => ({
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
  createWebhookYaml: vi.fn(
    (
      name: string,
      config: ModuleConfig,
      webhook: kind.MutatingWebhookConfiguration | kind.ValidatingWebhookConfiguration,
    ) => `mocked-yaml-${name}-${webhook ? "ok" : config.webhookTimeout}`,
  ),
}));

describe("Assets", () => {
  let moduleConfig: ModuleConfig;
  let assets: Assets;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  const createMockWebhookGenerator = (): Mock<
    () => Promise<V1MutatingWebhookConfiguration | V1ValidatingWebhookConfiguration | null>
  > =>
    vi
      .fn<() => Promise<V1MutatingWebhookConfiguration | V1ValidatingWebhookConfiguration | null>>()
      .mockResolvedValue(new kind.MutatingWebhookConfiguration());

  const createMockWatcher = (): Mock<() => kind.Deployment | null> =>
    vi.fn<() => kind.Deployment | null>().mockReturnValue(new kind.Deployment());

  const createMockModuleSecret = (): Mock<() => kind.Secret> =>
    vi.fn<() => kind.Secret>().mockReturnValue(new kind.Secret());

  beforeEach(() => {
    moduleConfig = {
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
    assets = new Assets(moduleConfig, "/tmp", ["secret1", "secret2"], "localhost");
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  afterAll(() => {
    vi.clearAllMocks();
  });

  it("should call deploy function that calls deployFunction with assets, force and webhookTimeout", async () => {
    const deployFunction = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    await assets.deploy(deployFunction, true, assets.config.webhookTimeout);

    expect(deployFunction).toHaveBeenCalledWith(assets, true, assets.config.webhookTimeout);
    expect(deployFunction).toHaveBeenCalledTimes(1);
  });

  it("should call zarfYaml that calls zarfYamlGenerator with assets, path, and manifests type", () => {
    const zarfYamlGenerator = vi.fn<() => string>().mockReturnValue("");
    assets.zarfYaml(zarfYamlGenerator, "/tmp");

    expect(zarfYamlGenerator).toHaveBeenCalledWith(assets, "/tmp", "manifests");
    expect(zarfYamlGenerator).toHaveBeenCalledTimes(1);
  });

  it("should call zarfYamlChart that calls zarfYamlGenerator with assets, path, and charts type", () => {
    const zarfYamlGenerator = vi.fn<() => string>().mockReturnValue("");
    assets.zarfYamlChart(zarfYamlGenerator, "/tmp");

    expect(zarfYamlGenerator).toHaveBeenCalledWith(assets, "/tmp", "charts");
    expect(zarfYamlGenerator).toHaveBeenCalledTimes(1);
  });

  it("should call allYaml that calls yamlGenerationFunction with assets deployments", async () => {
    const yamlGenerationFunction = vi.fn<() => Promise<string>>().mockResolvedValue("");
    const getDeploymentFunction = vi
      .fn<() => kind.Deployment>()
      .mockReturnValue(new kind.Deployment());
    const getWatcherFunction = vi
      .fn<() => kind.Deployment | null>()
      .mockReturnValue(new kind.Deployment());
    const getServiceFunction = vi
      .fn<() => kind.Service | null>()
      .mockReturnValue(new kind.Service());
    const getWatcherServiceFunction = vi
      .fn<() => kind.Service | null>()
      .mockReturnValue(new kind.Service());
    await assets.allYaml(yamlGenerationFunction, {
      getDeploymentFunction,
      getWatcherFunction,
      getServiceFunction,
      getWatcherServiceFunction,
    });
    const expectedDeployments = {
      admission: expect.any(Object),
      watch: expect.any(Object),
    };
    const expectedServices = {
      admission: expect.any(Object),
      watch: expect.any(Object),
    };
    expect(yamlGenerationFunction).toHaveBeenCalledTimes(1);
    expect(yamlGenerationFunction).toHaveBeenCalledWith(
      assets,
      expectedDeployments,
      expectedServices,
    );
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
    const validateWebhook: V1ValidatingWebhookConfiguration =
      new kind.ValidatingWebhookConfiguration();
    const mutateWebhook: V1MutatingWebhookConfiguration = new kind.MutatingWebhookConfiguration();
    await assets.writeWebhookFiles(validateWebhook, mutateWebhook, mockHelm);

    expect(fs.writeFile).toHaveBeenCalledTimes(4);
  });

  it("should call generateHelmChart which should call createDirectoryIfNotExists twice for templates and charts", async () => {
    const webhookGeneratorFunction = createMockWebhookGenerator();
    const getWatcherFunction = createMockWatcher();
    const getModuleSecretFunction = createMockModuleSecret();

    assets.capabilities = [
      {
        name: "capability-1",
        description: "test",
        namespaces: ["default"],
        bindings: [{ isWatch: true }] as unknown as Binding[],
        hasSchedule: false,
      },
    ];

    await assets.generateHelmChart(
      webhookGeneratorFunction,
      getWatcherFunction,
      getModuleSecretFunction,
      "/tmp",
    );
    expect(createDirectoryIfNotExists).toHaveBeenCalledTimes(2);
  });

  it("should call generateHelmChart which should write file 40 times for built Kubernetes Manifests and helm chart generation", async () => {
    const webhookGeneratorFunction = createMockWebhookGenerator();
    const getWatcherFunction = createMockWatcher();
    const getModuleSecretFunction = createMockModuleSecret();
    assets.capabilities = [
      {
        name: "capability-1",
        description: "test",
        namespaces: ["default"],
        bindings: [{ isWatch: true }] as unknown as Binding[],
        hasSchedule: false,
      },
    ];
    await assets.generateHelmChart(
      webhookGeneratorFunction,
      getWatcherFunction,
      getModuleSecretFunction,
      "/tmp",
    );
    expect(fs.writeFile).toHaveBeenCalledTimes(40);
  });

  it("should call generateHelmChart and get no error", async () => {
    const webhookGeneratorFunction = createMockWebhookGenerator();
    const getWatcherFunction = createMockWatcher();
    const getModuleSecretFunction = createMockModuleSecret();
    assets.capabilities = [
      {
        name: "capability-1",
        description: "test",
        namespaces: ["default"],
        bindings: [{ isWatch: true }] as unknown as Binding[],
        hasSchedule: false,
      },
    ];
    await assets.generateHelmChart(
      webhookGeneratorFunction,
      getWatcherFunction,
      getModuleSecretFunction,
      "/tmp",
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("should call generateHelmChart without an error when asset class instance is correct", async () => {
    const webhookGeneratorFunction = createMockWebhookGenerator();
    const getWatcherFunction = createMockWatcher();
    const getModuleSecretFunction = createMockModuleSecret();
    assets.capabilities = [
      {
        name: "capability-1",
        description: "test",
        namespaces: ["default"],
        bindings: [{ isWatch: true }] as unknown as Binding[],
        hasSchedule: false,
      },
    ];
    await assets.generateHelmChart(
      webhookGeneratorFunction,
      getWatcherFunction,
      getModuleSecretFunction,
      "/tmp",
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("should call generateHelmChart and throw an error when config is incorrect", async () => {
    const exitString =
      "Error generating helm chart: Cannot read properties of null (reading 'dirs')";

    (helmLayout as vi.Mock).mockReturnValue(null);

    const webhookGeneratorFunction = vi
      .fn<
        (
          assets: Assets,
          mutateOrValidate: WebhookType,
          timeoutSeconds: number | undefined,
        ) => Promise<V1MutatingWebhookConfiguration | V1ValidatingWebhookConfiguration | null>
      >()
      .mockResolvedValue(new kind.ValidatingWebhookConfiguration());
    const getWatcherFunction = createMockWatcher();
    const getModuleSecretFunction = createMockModuleSecret();

    await expect(
      assets.generateHelmChart(
        webhookGeneratorFunction,
        getWatcherFunction,
        getModuleSecretFunction,
        "/tmp",
      ),
    ).rejects.toThrow(exitString);
  });

  it("should return true from isAdmission and isWatcher when the binding has finalize", () => {
    const mockCapabilities = [
      {
        bindings: [{ isFinalize: true }],
        hasSchedule: false,
      },
    ] as unknown as CapabilityExport[];

    expect(isAdmission(mockCapabilities)).toBe(true);
    expect(isWatcher(mockCapabilities)).toBe(true);
  });
  it("should return true from isAdmission when any capability has mutate/validate/finalize", () => {
    const mockCapabilities = [
      {
        bindings: [{ isMutate: true }],
        hasSchedule: false,
      },
    ] as unknown as CapabilityExport[];

    expect(isAdmission(mockCapabilities)).toBe(true);
  });

  it("should return false from isAdmission when no capability has admission bindings", () => {
    const mockCapabilities = [
      {
        bindings: [{ isWatch: true }],
        hasSchedule: false,
      },
    ] as unknown as CapabilityExport[];

    expect(isAdmission(mockCapabilities)).toBe(false);
  });

  it("should return true from isWatcher when capability has hasSchedule", () => {
    const mockCapabilities = [
      {
        bindings: [],
        hasSchedule: true,
      },
    ] as unknown as CapabilityExport[];

    expect(isWatcher(mockCapabilities)).toBe(true);
  });

  it("should return true from isWatcher when capability has watch/queue/finalize binding", () => {
    const mockCapabilities = [
      {
        bindings: [{ isWatch: true }],
        hasSchedule: false,
      },
    ] as unknown as CapabilityExport[];

    expect(isWatcher(mockCapabilities)).toBe(true);
  });

  it("should return false from isWatcher when capability has no watch bindings or schedule", () => {
    const mockCapabilities = [
      {
        bindings: [{ isValidate: true }],
        hasSchedule: false,
      },
    ] as unknown as CapabilityExport[];

    expect(isWatcher(mockCapabilities)).toBe(false);
  });
});
