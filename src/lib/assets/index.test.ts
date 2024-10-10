// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Assets } from "./index";
import crypto from "crypto";
import { deploy } from "./deploy";
import { loadCapabilities } from "./loader";
import { ModuleConfig } from "../module";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("@kubernetes/client-node", () => ({
  dumpYaml: jest.fn(),
}));

// Mock all external dependencies that are used in the Assets class methods
jest.mock("fs", () => ({
  promises: {
    writeFile: jest.fn<() => Promise<void>>(),
    readFile: jest.fn<() => Promise<string>>().mockResolvedValue("mocked-module-code"),
    access: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  },
}));

jest.mock("crypto", () => ({
  randomBytes: jest.fn(() => Buffer.from("mocked-api-token")),
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => "mocked-hash"),
  })),
}));

jest.mock("./deploy");
jest.mock("./loader", () => ({
  loadCapabilities: jest.fn(),
}));
jest.mock("./helm");
jest.mock("../tls", () => ({
  genTLS: jest.fn(() => "mocked-tls"),
}));

jest.mock("../helpers", () => {
  const originalModule = jest.requireActual("../helpers");
  return {
    ...(typeof originalModule === "object" ? originalModule : {}),
    createDirectoryIfNotExists: jest.fn().mockImplementation((path: unknown) => {
      const pathStr = path as string;
      if (pathStr.includes("fail")) {
        throw new Error("Test error while creating directories");
      }
    }),
    secretOverLimit: jest.fn().mockReturnValue(false), // Mock secretOverLimit to always return false
  };
});

jest.mock("./rbac", () => ({
  getClusterRoles: jest.fn(() => [
    {
      kind: "ClusterRole",
      apiVersion: "rbac.authorization.k8s.io/v1",
      metadata: { name: "test-cluster-role" },
      rules: [{ apiGroups: ["*"], resources: ["*"], verbs: ["*"] }],
    },
  ]),
  getClusterRoleBindings: jest.fn(() => [
    {
      kind: "ClusterRoleBinding",
      apiVersion: "rbac.authorization.k8s.io/v1",
      metadata: { name: "test-cluster-role-binding" },
      roleRef: { apiGroup: "rbac.authorization.k8s.io", kind: "ClusterRole", name: "test-cluster-role" },
      subjects: [{ kind: "ServiceAccount", name: "default", namespace: "default" }],
    },
  ]),
  getServiceAccounts: jest.fn(() => [
    {
      kind: "ServiceAccount",
      apiVersion: "v1",
      metadata: { name: "test-service-account", namespace: "default" },
    },
  ]),
  getStoreRoles: jest.fn(() => [
    {
      kind: "Role",
      apiVersion: "rbac.authorization.k8s.io/v1",
      metadata: { name: "test-role", namespace: "default" },
      rules: [{ apiGroups: ["*"], resources: ["*"], verbs: ["*"] }],
    },
  ]),
  getStoreRoleBindings: jest.fn(() => [
    {
      kind: "RoleBinding",
      apiVersion: "rbac.authorization.k8s.io/v1",
      metadata: { name: "test-role-binding", namespace: "default" },
      roleRef: { apiGroup: "rbac.authorization.k8s.io", kind: "Role", name: "test-role" },
      subjects: [{ kind: "ServiceAccount", name: "default", namespace: "default" }],
    },
  ]),
  getCustomClusterRoleRules: jest.fn(() => [{ apiGroups: ["*"], resources: ["*"], verbs: ["*"] }]),
  getCustomStoreRoleRules: jest.fn(() => [{ apiGroups: ["*"], resources: ["*"], verbs: ["*"] }]),
}));

describe("Assets Class", () => {
  const mockModuleConfig: ModuleConfig = {
    uuid: "test-uuid",
    peprVersion: "1.0.0",
    onError: "reject",
    webhookTimeout: 30,
    description: "Test Pepr Module",
    alwaysIgnore: { namespaces: [] },
  };

  let assets: Assets;

  beforeEach(() => {
    assets = new Assets(mockModuleConfig, "test-path");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should correctly initialize the Assets class", () => {
    expect(assets.name).toBe(`pepr-${mockModuleConfig.uuid}`);
    expect(assets.buildTimestamp).toBeDefined();
    expect(assets.tls).toBe("mocked-tls");
    expect(crypto.randomBytes).toHaveBeenCalledWith(32);
  });

  describe("generateHelmChart", () => {
    it("should throw an error when generateHelmChart fails", async () => {
      await expect(assets.generateHelmChart("/fail-path")).rejects.toThrow(
        "Error generating helm chart: Test error while creating directories",
      );
    });
  });

  describe("deploy", () => {
    it("should call deploy with correct parameters", async () => {
      (loadCapabilities as jest.MockedFunction<typeof loadCapabilities>).mockResolvedValue([]);
      await assets.deploy(true, 60);

      expect(deploy).toHaveBeenCalledWith(assets, true, 60);
    });
  });
});
