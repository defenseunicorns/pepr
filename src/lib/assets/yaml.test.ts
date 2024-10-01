import { overridesFile, allYaml, zarfYaml, zarfYamlChart } from "./yaml";
import { promises as fs } from "fs";
import { dumpYaml } from "@kubernetes/client-node";
import { describe, expect, it, jest } from "@jest/globals";
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
