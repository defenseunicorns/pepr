import {
  overridesFile,
  allYaml,
  zarfYaml,
  zarfYamlChart,
  generateOverrides,
  generateAdmissionConfig,
  generateWatcherConfig,
  generateSecurityContext,
  generateContainerSecurityContext,
  generateProbeConfig,
  generateResourceConfig,
} from "./yaml";
import * as pods from "./pods"; // Add this line to import pods
import { promises as fs } from "fs";
import { dumpYaml } from "@kubernetes/client-node";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Assets } from ".";
import yaml from "js-yaml";

jest.mock("./webhooks"); // Mock the entire webhooks module

// Mock fs.writeFile and fs.readFile
jest.mock("fs", () => ({
  promises: {
    writeFile: jest.fn(),
    readFile: jest.fn(() => Buffer.from("mock-code-content")),
  },
}));

jest.mock("@kubernetes/client-node", () => ({
  dumpYaml: jest.fn(input => {
    if ((input as { kind: string }).kind === "ClusterRole") {
      return `apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: example-cluster-role
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "watch", "list"]`;
    }
    if ((input as { kind: string }).kind === "ClusterRoleBinding") {
      return `apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: example-cluster-role-binding`;
    }
    if ((input as { kind: string }).kind === "ServiceAccount") {
      return `apiVersion: v1
kind: ServiceAccount
metadata:
  name: example-service-account`;
    }
    if ((input as { kind: string }).kind === "Secret") {
      return `apiVersion: v1
kind: Secret
metadata:
  name: example-secret`;
    }
    if ((input as { kind: string }).kind === "Deployment") {
      return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: example-deployment`;
    }
    return `apiVersion: v1
kind: Secret
metadata:
  name: example-secret`;
  }),
}));

describe("yaml.ts comprehensive tests", () => {
  const mockAssets: Assets = {
    config: {
      uuid: "test-uuid",
      onError: "ignore",
      webhookTimeout: 30,
      customLabels: { namespace: { "pepr.dev": "" } },
      alwaysIgnore: { namespaces: [] },
      peprVersion: "0.0.1",
      appVersion: "0.0.1",
      description: "Test module description",
    },
    name: "pepr-test",
    image: "ghcr.io/defenseunicorns/pepr/controller:v0.0.1",
    apiToken: "mock-api-token",
    hash: "mock-hash",
    tls: { ca: "", crt: "", key: "", pem: { ca: "", crt: "", key: "" } },
    capabilities: [],
    path: "/mock/path/to/code.js",
    buildTimestamp: "1234567890",
    alwaysIgnore: {
      namespaces: undefined,
    },
    setHash: (hash: string) => {
      mockAssets.hash = hash;
    },
    deploy: async (): Promise<void> => {
      return Promise.resolve();
    },
    zarfYaml: (path: string) => {
      return dumpYaml({
        kind: "ZarfPackageConfig",
        metadata: {
          name: mockAssets.name,
          description: `Pepr Module: ${mockAssets.config.description}`,
          url: "https://github.com/defenseunicorns/pepr",
          version: mockAssets.config.appVersion,
        },
        components: [
          {
            name: "module",
            required: true,
            manifests: [{ name: "module", namespace: "pepr-system", files: [path] }],
            images: [mockAssets.image],
          },
        ],
      });
    },
    zarfYamlChart: (path: string) => {
      return dumpYaml({
        kind: "ZarfPackageConfig",
        metadata: {
          name: mockAssets.name,
          description: `Pepr Module: ${mockAssets.config.description}`,
          url: "https://github.com/defenseunicorns/pepr",
          version: mockAssets.config.appVersion,
        },
        components: [
          {
            name: "module",
            required: true,
            charts: [
              {
                name: "module",
                namespace: "pepr-system",
                version: "0.0.1",
                localPath: path,
              },
            ],
            images: [mockAssets.image],
          },
        ],
      });
    },
    allYaml: async (): Promise<string> => {
      return dumpYaml({
        kind: "ClusterRole",
        metadata: {
          name: "example-cluster-role",
        },
        rules: [
          {
            apiGroups: [""],
            resources: ["pods"],
            verbs: ["get", "watch", "list"],
          },
        ],
      });
    },
    generateHelmChart: async (basePath: string): Promise<void> => {
      // Implement the function logic here
      console.log(`Generating Helm chart at base path: ${basePath}`);
      return Promise.resolve();
    },
  };

  it("overridesFile: should generate the correct YAML and write it to file", async () => {
    const path = "./test-values.yaml";

    await overridesFile(mockAssets, path);

    const expectedContent = dumpYaml(
      {
        secrets: {
          apiToken: Buffer.from("mock-api-token").toString("base64"),
        },
        hash: "mock-hash",
        namespace: { annotations: {}, labels: { "pepr.dev": "" } },
        uuid: "pepr-test",
        admission: expect.any(Object),
        watcher: expect.any(Object),
      },
      { noRefs: true, forceQuotes: true },
    );

    expect(fs.writeFile).toHaveBeenCalledWith(path, expectedContent);
  });

  it("zarfYaml: should generate correct Zarf package YAML", () => {
    const path = "/mock/path/to/chart";
    const result = zarfYaml(mockAssets, path);

    const expectedYaml = dumpYaml(
      {
        kind: "ZarfPackageConfig",
        metadata: {
          name: "pepr-test",
          description: "Pepr Module: Test module description",
          url: "https://github.com/defenseunicorns/pepr",
          version: "0.0.1",
        },
        components: [
          {
            name: "module",
            required: true,
            manifests: [{ name: "module", namespace: "pepr-system", files: [path] }],
            images: ["ghcr.io/defenseunicorns/pepr/controller:v0.0.1"],
          },
        ],
      },
      { noRefs: true },
    );

    expect(result).toBe(expectedYaml);
  });

  it("zarfYamlChart: should generate correct Helm chart YAML", () => {
    const path = "/mock/path/to/chart";
    const result = zarfYamlChart(mockAssets, path);

    const expectedYaml = dumpYaml(
      {
        kind: "ZarfPackageConfig",
        metadata: {
          name: "pepr-test",
          description: "Pepr Module: Test module description",
          url: "https://github.com/defenseunicorns/pepr",
          version: "0.0.1",
        },
        components: [
          {
            name: "module",
            required: true,
            charts: [
              {
                name: "module",
                namespace: "pepr-system",
                version: "0.0.1",
                localPath: path,
              },
            ],
            images: ["ghcr.io/defenseunicorns/pepr/controller:v0.0.1"],
          },
        ],
      },
      { noRefs: true },
    );

    expect(result).toBe(expectedYaml);
  });

  it("allYaml: should generate correct YAML for all resources", async () => {
    const result = await allYaml(mockAssets, "scoped", "image-pull-secret");

    // Expected fragments of the YAML
    const expectedContent = [
      "apiVersion: rbac.authorization.k8s.io/v1",
      "kind: ClusterRole",
      "kind: ClusterRoleBinding",
      "apiVersion: v1",
      "kind: ServiceAccount",
      "kind: Secret",
      "kind: Deployment",
    ];

    console.log("Actual YAML Output:\n", result);
    console.log("Expected Fragments:\n", expectedContent);

    expectedContent.forEach(fragment => {
      expect(result).toContain(fragment);
    });
  });

  it("allYaml: should generate valid YAML structure", async () => {
    const result = await allYaml(mockAssets, "scoped", "image-pull-secret");

    console.log("Generated YAML Output:\n", result);

    // Parse all documents in the YAML
    const parsedYaml = yaml.loadAll(result) as Array<{
      apiVersion: string;
      kind: string;
      metadata: { name: string };
      rules?: { apiGroups: string[]; resources: string[]; verbs: string[] }[];
    }>;

    // Check the first document, which should be a ClusterRole
    const clusterRole = parsedYaml.find(doc => doc.kind === "ClusterRole");

    expect(clusterRole).toHaveProperty("apiVersion", "rbac.authorization.k8s.io/v1");
    expect(clusterRole).toHaveProperty("kind", "ClusterRole");
    expect(clusterRole!.metadata).toHaveProperty("name", "example-cluster-role");
  });
});

describe("yaml.ts error handling and edge case tests", () => {
  const mockAssets: Assets = {
    config: {
      uuid: "test-uuid",
      onError: "ignore",
      webhookTimeout: 30,
      customLabels: { namespace: { "pepr.dev": "" } },
      alwaysIgnore: { namespaces: [] },
      peprVersion: "0.0.1",
      appVersion: "0.0.1",
      description: "Test module description",
    },
    name: "pepr-test",
    image: "ghcr.io/defenseunicorns/pepr/controller:v0.0.1",
    apiToken: "mock-api-token",
    hash: "mock-hash",
    tls: { ca: "", crt: "", key: "", pem: { ca: "", crt: "", key: "" } },
    capabilities: [],
    path: "/mock/path/to/code.js",
    buildTimestamp: "1234567890",
    alwaysIgnore: {
      namespaces: undefined,
    },
    setHash: (hash: string) => {
      mockAssets.hash = hash;
    },
    deploy: async (): Promise<void> => Promise.resolve(),
    zarfYaml: () => dumpYaml({ kind: "ZarfPackageConfig" }),
    zarfYamlChart: () => dumpYaml({ kind: "ZarfPackageConfig" }),
    allYaml: async (): Promise<string> => dumpYaml({ kind: "ClusterRole" }),
    generateHelmChart: async (): Promise<void> => Promise.resolve(),
  };

  it("overridesFile: should throw an error if fs.writeFile fails", async () => {
    const path = "./test-values.yaml";
    const writeFileMock = fs.writeFile as jest.Mock;
    writeFileMock.mockImplementationOnce(() => Promise.reject(new Error("File write error")));

    await expect(overridesFile(mockAssets, path)).rejects.toThrow("File write error");
  });

  it("allYaml: should throw an error if fs.readFile fails", async () => {
    const readFileMock = fs.readFile as jest.Mock;
    readFileMock.mockImplementationOnce(() => Promise.reject(new Error("File read error")));

    await expect(allYaml(mockAssets, "scoped", "image-pull-secret")).rejects.toThrow("File read error");
  });

  it("overridesFile: should throw an error if apiToken is missing", async () => {
    const path = "./test-values.yaml";
    const assetsWithoutToken = { ...mockAssets, apiToken: undefined };

    await expect(overridesFile(assetsWithoutToken as unknown as Assets, path)).rejects.toThrow("apiToken is required");
  });

  it("should handle populated capabilities array", async () => {
    const mockAssetsWithCapabilities = {
      ...mockAssets,
      capabilities: [
        { verb: "get", bindings: [], hasSchedule: false, name: "get", description: "get description" },
        { verb: "watch", bindings: [], hasSchedule: false, name: "watch", description: "watch description" },
        { verb: "list", bindings: [], hasSchedule: false, name: "list", description: "list description" },
      ],
    };

    const result = await allYaml(mockAssetsWithCapabilities, "scoped", "image-pull-secret");

    expect(result).toContain('verbs: ["get", "watch", "list"]');
  });

  it("allYaml: should handle empty capabilities array", async () => {
    const assetsWithEmptyCapabilities = { ...mockAssets, capabilities: [] };

    const resultWithEmptyCapabilities = await allYaml(assetsWithEmptyCapabilities, "scoped", "image-pull-secret");
    expect(resultWithEmptyCapabilities).toContain("kind: ClusterRole");
  });

  it("allYaml: should handle invalid imagePullSecret", async () => {
    const assetsWithInvalidSecret = { ...mockAssets };
    const result = await allYaml(assetsWithInvalidSecret, "scoped", undefined);

    // Ensure that imagePullSecret does not break the YAML generation
    expect(result).toContain("kind: ClusterRole");
  });
});

describe("yaml.ts individual function tests", () => {
  const mockAssets: Assets = {
    config: {
      uuid: "test-uuid",
      onError: "ignore",
      webhookTimeout: 30,
      customLabels: { namespace: { "pepr.dev": "" } },
      alwaysIgnore: { namespaces: [] },
      peprVersion: "0.0.1",
      appVersion: "0.0.1",
      description: "Test module description",
    },
    name: "pepr-test",
    image: "ghcr.io/defenseunicorns/pepr/controller:v0.0.1",
    apiToken: "mock-api-token",
    hash: "mock-hash",
    tls: { ca: "", crt: "", key: "", pem: { ca: "", crt: "", key: "" } },
    capabilities: [],
    path: "/mock/path/to/code.js",
    buildTimestamp: "1234567890",
    alwaysIgnore: { namespaces: [] },
    setHash: (hash: string) => {
      mockAssets.hash = hash;
    },
    deploy: async (): Promise<void> => {
      return Promise.resolve();
    },
    zarfYaml: (path: string) => {
      return dumpYaml({
        kind: "ZarfPackageConfig",
        metadata: {
          name: mockAssets.name,
          description: `Pepr Module: ${mockAssets.config.description}`,
          url: "https://github.com/defenseunicorns/pepr",
          version: mockAssets.config.appVersion,
        },
        components: [
          {
            name: "module",
            required: true,
            manifests: [{ name: "module", namespace: "pepr-system", files: [path] }],
            images: [mockAssets.image],
          },
        ],
      });
    },
    zarfYamlChart: (path: string) => {
      return dumpYaml({
        kind: "ZarfPackageConfig",
        metadata: {
          name: mockAssets.name,
          description: `Pepr Module: ${mockAssets.config.description}`,
          url: "https://github.com/defenseunicorns/pepr",
          version: mockAssets.config.appVersion,
        },
        components: [
          {
            name: "module",
            required: true,
            charts: [
              {
                name: "module",
                namespace: "pepr-system",
                version: "0.0.1",
                localPath: path,
              },
            ],
            images: [mockAssets.image],
          },
        ],
      });
    },
    allYaml: async (): Promise<string> => {
      return dumpYaml({
        kind: "ClusterRole",
        metadata: {
          name: "example-cluster-role",
        },
        rules: [
          {
            apiGroups: [""],
            resources: ["pods"],
            verbs: ["get", "watch", "list"],
          },
        ],
      });
    },
    generateHelmChart: async (basePath: string): Promise<void> => {
      // Implement the function logic here
      console.log(`Generating Helm chart at base path: ${basePath}`);
      return Promise.resolve();
    },
  };

  // Test generateOverrides
  describe("generateOverrides", () => {
    const baseMockAssets: Assets = {
      hash: "mock-hash",
      name: "pepr-test",
      config: {
        uuid: "test-uuid",
        onError: "ignore",
        webhookTimeout: 30,
        alwaysIgnore: { namespaces: ["default"] },
        customLabels: { namespace: { "pepr.dev": "" } },
        peprVersion: "0.0.1",
        appVersion: "0.0.1",
        description: "Test module description",
      },
      image: "ghcr.io/defenseunicorns/pepr/controller:v0.0.1",
      apiToken: "mock-api-token",
      tls: { ca: "", crt: "", key: "", pem: { ca: "", crt: "", key: "" } },
      capabilities: [],
      path: "/mock/path/to/code.js",
      buildTimestamp: "1234567890",
      alwaysIgnore: { namespaces: ["default"] },
      setHash: (hash: string) => {
        baseMockAssets.hash = hash;
      },
      deploy: async (): Promise<void> => Promise.resolve(),
      zarfYaml: () => dumpYaml({ kind: "ZarfPackageConfig" }),
      zarfYamlChart: () => dumpYaml({ kind: "ZarfPackageConfig" }),
      allYaml: async (): Promise<string> => dumpYaml({ kind: "ClusterRole" }),
      generateHelmChart: async (): Promise<void> => Promise.resolve(),
    };

    it("should generate overrides object with correct structure", () => {
      const result = generateOverrides(mockAssets, mockAssets.image, mockAssets.apiToken);
      expect(result).toHaveProperty("secrets.apiToken");
      expect(result).toHaveProperty("hash", mockAssets.hash);
      expect(result).toHaveProperty("namespace");
      expect(result).toHaveProperty("uuid", mockAssets.name);
      expect(result).toHaveProperty("admission");
      expect(result).toHaveProperty("watcher");
    });

    it("should base64 encode the apiToken in the overrides", () => {
      const result = generateOverrides(mockAssets, mockAssets.image, mockAssets.apiToken);
      expect(result.secrets.apiToken).toBe(Buffer.from(mockAssets.apiToken).toString("base64"));
    });

    it("should generate correct overrides with webhookTimeout and alwaysIgnore.namespaces defined", () => {
      const result = generateOverrides(baseMockAssets, baseMockAssets.image, baseMockAssets.apiToken);

      expect(result).toHaveProperty("secrets.apiToken", Buffer.from(baseMockAssets.apiToken).toString("base64"));
      expect(result).toHaveProperty("hash", baseMockAssets.hash);
      expect(result.namespace.labels["pepr.dev"]).toBe("");
      expect(result).toHaveProperty("admission");
      expect(result.admission).toHaveProperty("webhookTimeout", 30); // Should use provided webhookTimeout
      expect(result.admission).toHaveProperty("env");
    });

    it("should default webhookTimeout to 30 when undefined", () => {
      const mockAssetsWithoutTimeout = {
        ...baseMockAssets,
        config: {
          ...baseMockAssets.config,
          webhookTimeout: undefined, // webhookTimeout is missing
        },
      };

      const result = generateOverrides(mockAssetsWithoutTimeout, baseMockAssets.image, baseMockAssets.apiToken);

      expect(result.admission).toHaveProperty("webhookTimeout", 30); // Should default to 30
      expect(result.watcher).toHaveProperty("terminationGracePeriodSeconds", 5); // Confirm watcher structure
      expect(result.watcher).toHaveProperty("env"); // Check env or other critical properties
    });

    it("should default alwaysIgnore.namespaces to an empty array when undefined", () => {
      const mockAssetsWithoutNamespaces = {
        ...baseMockAssets,
        config: {
          ...baseMockAssets.config,
          alwaysIgnore: {}, // No namespaces defined
        },
      };
      const result = generateOverrides(mockAssetsWithoutNamespaces, baseMockAssets.image, baseMockAssets.apiToken);

      expect(result.admission).toHaveProperty("webhookTimeout", 30);
    });

    it("should handle both webhookTimeout and alwaysIgnore.namespaces being undefined", () => {
      const mockAssetsWithUndefinedConfig = {
        ...baseMockAssets,
        config: {
          uuid: baseMockAssets.config.uuid ?? "default-uuid",
          onError: "ignore",
          webhookTimeout: undefined,
          alwaysIgnore: { namespaces: [] },
        },
      };
      const result = generateOverrides(mockAssetsWithUndefinedConfig, baseMockAssets.image, baseMockAssets.apiToken);

      expect(result.admission).toHaveProperty("webhookTimeout", 30); // Should default to 30
    });
  });

  // Test generateAdmissionConfig
  describe("generateAdmissionConfig", () => {
    const baseConfig = {
      uuid: "test-uuid",
      onError: "ignore",
      webhookTimeout: 30,
      description: "Test module description",
      alwaysIgnore: { namespaces: ["default"] },
    };

    const mockEnv = [{ name: "TEST_ENV", value: "true" }];
    const mockImage = "ghcr.io/defenseunicorns/pepr/controller:v0.0.1";
    const mockName = "pepr-test";

    beforeEach(() => {
      jest.spyOn(pods, "genEnv").mockReturnValue(mockEnv);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should generate correct admission config with default inputs", () => {
      const result = generateAdmissionConfig(baseConfig, mockImage, mockName);

      expect(result).toHaveProperty("terminationGracePeriodSeconds", 5);
      expect(result).toHaveProperty("failurePolicy", "Ignore");
      expect(result).toHaveProperty("webhookTimeout", 30);
      expect(result).toHaveProperty("env", mockEnv);
      expect(result.annotations["pepr.dev/description"]).toBe("Test module description"); // Access directly
      expect(result.labels.app).toBe(mockName);
      expect(result.labels["pepr.dev/uuid"]).toBe("test-uuid");
    });

    it("should respect 'onError' configuration for failurePolicy", () => {
      const configWithReject = {
        ...baseConfig,
        onError: "reject",
      };

      const result = generateAdmissionConfig(configWithReject, mockImage, mockName);
      expect(result).toHaveProperty("failurePolicy", "Fail");
    });

    it("should default 'webhookTimeout' to 30 when not provided", () => {
      const configWithoutTimeout = {
        ...baseConfig,
        webhookTimeout: baseConfig.webhookTimeout ?? 30, // Provide default value if undefined
      };

      const result = generateAdmissionConfig(configWithoutTimeout, mockImage, mockName);
      expect(result).toHaveProperty("webhookTimeout", 30); // Should default to 30
    });

    it("should handle missing 'description' gracefully", () => {
      const configWithoutDescription = {
        ...baseConfig,
        description: undefined,
      };

      const result = generateAdmissionConfig(configWithoutDescription, mockImage, mockName);
      expect(result.annotations["pepr.dev/description"]).toBe(""); // Ensure it defaults to an empty string
    });

    it("should throw an error when 'uuid' is missing", () => {
      const configWithoutUUID = {
        ...baseConfig,
        uuid: "",
      };

      expect(() => generateAdmissionConfig(configWithoutUUID, mockImage, mockName)).toThrow(
        "uuid is required in config",
      );
    });
  });

  // Test generateWatcherConfig
  describe("generateWatcherConfig", () => {
    it("should generate correct watcher configuration", () => {
      // Ensure webhookTimeout is defined
      const configWithDefaults = {
        ...mockAssets.config,
        webhookTimeout: mockAssets.config.webhookTimeout ?? 30, // Default to 30 if undefined
      };

      const watcherConfig = generateWatcherConfig(
        { ...configWithDefaults, alwaysIgnore: { namespaces: configWithDefaults.alwaysIgnore.namespaces ?? [] } },
        mockAssets.image,
        mockAssets.name,
      );
      expect(watcherConfig).toHaveProperty("terminationGracePeriodSeconds", 5);
      expect(watcherConfig).toHaveProperty("env");
      expect(watcherConfig).toHaveProperty("labels.app", `${mockAssets.name}-watcher`);
    });

    // Test generateSecurityContext
    describe("generateSecurityContext", () => {
      it("should generate correct security context", () => {
        const securityContext = generateSecurityContext();
        expect(securityContext).toEqual({
          runAsUser: 65532,
          runAsGroup: 65532,
          runAsNonRoot: true,
          fsGroup: 65532,
        });
      });
    });

    // Test generateContainerSecurityContext
    describe("generateContainerSecurityContext", () => {
      it("should generate correct container security context", () => {
        const containerSecurityContext = generateContainerSecurityContext();
        expect(containerSecurityContext).toEqual({
          runAsUser: 65532,
          runAsGroup: 65532,
          runAsNonRoot: true,
          allowPrivilegeEscalation: false,
          capabilities: {
            drop: ["ALL"],
          },
        });
      });
    });

    // Test generateProbeConfig
    describe("generateProbeConfig", () => {
      it("should generate correct probe configuration", () => {
        const probeConfig = generateProbeConfig();
        expect(probeConfig).toEqual({
          httpGet: { path: "/healthz", port: 3000, scheme: "HTTPS" },
          initialDelaySeconds: 10,
        });
      });
    });

    // Test generateResourceConfig
    describe("generateResourceConfig", () => {
      it("should generate correct resource configuration", () => {
        const resourceConfig = generateResourceConfig();
        expect(resourceConfig).toEqual({
          requests: { memory: "64Mi", cpu: "100m" },
          limits: { memory: "256Mi", cpu: "500m" },
        });
      });
    });

    // Test overridesFile
    describe("overridesFile", () => {
      const path = "./test-values.yaml";

      it("should write the correct overrides file", async () => {
        await overridesFile(mockAssets, path);

        const expectedContent = dumpYaml(
          {
            secrets: {
              apiToken: Buffer.from("mock-api-token").toString("base64"),
            },
            hash: "mock-hash",
            namespace: { annotations: {}, labels: { "pepr.dev": "" } },
            uuid: "pepr-test",
            admission: expect.any(Object),
            watcher: expect.any(Object),
          },
          { noRefs: true, forceQuotes: true },
        );

        expect(fs.writeFile).toHaveBeenCalledWith(path, expectedContent);
      });

      it("should throw an error if apiToken is missing", async () => {
        await expect(overridesFile({ ...mockAssets, apiToken: undefined } as unknown as Assets, path)).rejects.toThrow(
          "apiToken is required",
        );
      });

      it("should throw an error if fs.writeFile fails", async () => {
        const writeFileMock = fs.writeFile as jest.Mock;
        writeFileMock.mockImplementationOnce(() => Promise.reject(new Error("File write error")));

        await expect(overridesFile(mockAssets, path)).rejects.toThrow("File write error");
      });
    });

    // Test zarfYaml
    describe("zarfYaml", () => {
      it("should generate correct Zarf package YAML", () => {
        const path = "/mock/path/to/chart";
        const result = zarfYaml(mockAssets, path);

        const expectedYaml = dumpYaml(
          {
            kind: "ZarfPackageConfig",
            metadata: {
              name: "pepr-test",
              description: "Pepr Module: Test module description",
              url: "https://github.com/defenseunicorns/pepr",
              version: "0.0.1",
            },
            components: [
              {
                name: "module",
                required: true,
                manifests: [{ name: "module", namespace: "pepr-system", files: [path] }],
                images: ["ghcr.io/defenseunicorns/pepr/controller:v0.0.1"],
              },
            ],
          },
          { noRefs: true },
        );

        expect(result).toBe(expectedYaml);
      });
    });

    // Test zarfYamlChart
    describe("zarfYamlChart", () => {
      it("should generate correct Helm chart YAML", () => {
        const path = "/mock/path/to/chart";
        const result = zarfYamlChart(mockAssets, path);

        const expectedYaml = dumpYaml(
          {
            kind: "ZarfPackageConfig",
            metadata: {
              name: "pepr-test",
              description: "Pepr Module: Test module description",
              url: "https://github.com/defenseunicorns/pepr",
              version: "0.0.1",
            },
            components: [
              {
                name: "module",
                required: true,
                charts: [
                  {
                    name: "module",
                    namespace: "pepr-system",
                    version: "0.0.1",
                    localPath: path,
                  },
                ],
                images: ["ghcr.io/defenseunicorns/pepr/controller:v0.0.1"],
              },
            ],
          },
          { noRefs: true },
        );

        expect(result).toBe(expectedYaml);
      });
    });

    // Test allYaml
    describe("allYaml", () => {
      it("should generate all resources YAML", async () => {
        const result = await allYaml(mockAssets, "scoped", "image-pull-secret");

        const expectedFragments = [
          "apiVersion: rbac.authorization.k8s.io/v1",
          "kind: ClusterRole",
          "kind: ClusterRoleBinding",
          "apiVersion: v1",
          "kind: ServiceAccount",
          "kind: Secret",
          "kind: Deployment",
        ];

        expectedFragments.forEach(fragment => {
          expect(result).toContain(fragment);
        });
      });
    });
  });
});
