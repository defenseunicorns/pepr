import fs from "fs";
//import path from "path";
import Log from "../logger";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import {
  readPackageJson,
  getPeprConfig,
  getCustomRBACField,
  getCustomClusterRoleRules,
  getCustomStoreRoleRules,
  readCustomRBAC,
  getClusterRoles,
  getClusterRoleBindings,
  getServiceAccounts,
  getStoreRoles,
  getStoreRoleBindings,
} from "./rbac";
import { CapabilityExport } from "../types";

// Mock the file system and logging functionalities
jest.mock("fs");
jest.mock("../logger");

describe("RBAC Module Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("readPackageJson", () => {
    test("Should correctly read package.json from the file system", () => {
      const mockFileContent = JSON.stringify({ name: "pepr-test-module", version: "0.0.1" });
      (fs.readFileSync as jest.Mock).mockReturnValue(mockFileContent);

      const result = readPackageJson();
      expect(result).toEqual({ name: "pepr-test-module", version: "0.0.1" });
    });

    test("Should throw an error when package.json is unreadable", () => {
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error("File not found");
      });

      expect(() => readPackageJson()).toThrow("Error reading or parsing package.json: File not found");
    });
  });

  describe("getPeprConfig", () => {
    test("Should return the pepr configuration when present in package data", () => {
      const mockPackageData = { pepr: { rbac: { clusterRoles: [] } } };
      const result = getPeprConfig(mockPackageData);
      expect(result).toEqual(mockPackageData.pepr);
    });

    test("Should return an empty object when pepr configuration is missing", () => {
      const mockPackageData = {};
      const result = getPeprConfig(mockPackageData);
      expect(result).toEqual({});
      expect(Log.info).toHaveBeenCalledWith("No 'pepr' configuration found in package.json.");
    });
  });

  describe("getCustomRBACField", () => {
    test("Should return an empty array when RBAC field is missing", () => {
      const mockPackageData = { pepr: { rbac: {} } };
      const result = getCustomRBACField("clusterRoles", mockPackageData);
      expect(result).toEqual([]);
      expect(Log.info).toHaveBeenCalledWith(
        "No custom RBAC items found for clusterRoles. Processing will continue without these items.",
      );
    });

    test("Should return the specified RBAC field when present", () => {
      const mockPackageData = {
        pepr: {
          rbac: {
            clusterRoles: [
              { rules: [{ apiGroups: ["apps"], resources: ["deployments"], verbs: ["create", "update"] }] },
            ],
          },
        },
      };
      const result = getCustomRBACField("clusterRoles", mockPackageData);
      expect(result).toEqual(mockPackageData.pepr.rbac.clusterRoles);
    });
  });

  describe("getCustomClusterRoleRules", () => {
    test("Should correctly extract custom cluster role rules from package.json", () => {
      const mockPackageData = {
        pepr: {
          rbac: {
            clusterRoles: [{ rules: [{ apiGroups: [""], resources: ["nodes"], verbs: ["get", "list"] }] }],
          },
        },
      };

      const result = getCustomClusterRoleRules(mockPackageData);
      expect(result).toEqual([{ apiGroups: [""], resources: ["nodes"], verbs: ["get", "list"] }]);
    });

    test("Should return an empty array when cluster role rules are missing", () => {
      const mockPackageData = { pepr: { rbac: { clusterRoles: [] } } };
      const result = getCustomClusterRoleRules(mockPackageData);
      expect(result).toEqual([]);
    });
  });

  describe("getCustomStoreRoleRules", () => {
    test("Should correctly extract custom store role rules from package.json", () => {
      const mockPackageData = {
        pepr: {
          rbac: {
            roles: [{ rules: [{ apiGroups: ["apps"], resources: ["deployments"], verbs: ["create", "update"] }] }],
          },
        },
      };

      const result = getCustomStoreRoleRules(mockPackageData);
      expect(result).toEqual([{ apiGroups: ["apps"], resources: ["deployments"], verbs: ["create", "update"] }]);
    });

    test("Should return an empty array when store role rules are missing", () => {
      const mockPackageData = { pepr: { rbac: { roles: [] } } };
      const result = getCustomStoreRoleRules(mockPackageData);
      expect(result).toEqual([]);
    });
  });

  describe("readCustomRBAC", () => {
    test("Should correctly read and validate custom RBAC configuration", () => {
      const mockPackageData = {
        pepr: {
          rbac: {
            roles: [
              {
                metadata: { name: "test-role" },
                rules: [{ apiGroups: ["apps"], resources: ["deployments"], verbs: ["create", "update"] }],
              },
            ],
            clusterRoles: [
              {
                metadata: { name: "test-cluster-role" },
                rules: [{ apiGroups: [""], resources: ["nodes"], verbs: ["get", "list"] }],
              },
            ],
          },
        },
      };

      const result = readCustomRBAC(mockPackageData);
      expect(result).toEqual(mockPackageData.pepr.rbac);
    });

    test("Should return empty RBAC configuration when package data is invalid", () => {
      const result = readCustomRBAC();
      expect(result).toEqual({ roles: [], clusterRoles: [] });
    });
  });

  describe("getClusterRoles", () => {
    test("Should generate a ClusterRole with scoped access", () => {
      const capabilities = [
        {
          apiGroups: ["apps"],
          resources: ["deployments"],
          verbs: ["create", "update"],
          bindings: [],
          hasSchedule: false,
          name: "",
          description: "",
        },
      ];
      const result = getClusterRoles("test-cluster-role", capabilities, "scoped");
      expect(result).toEqual({
        apiVersion: "rbac.authorization.k8s.io/v1",
        kind: "ClusterRole",
        metadata: { name: "test-cluster-role" },
        rules: [{ apiGroups: ["apps"], resources: ["deployments"], verbs: ["create", "update"] }],
      });
    });

    test("Should generate a ClusterRole with full access", () => {
      const capabilities: CapabilityExport[] = [];
      const result = getClusterRoles("test-cluster-role", capabilities);
      expect(result).toEqual({
        apiVersion: "rbac.authorization.k8s.io/v1",
        kind: "ClusterRole",
        metadata: { name: "test-cluster-role" },
        rules: [
          {
            apiGroups: ["*"],
            resources: ["*"],
            verbs: ["create", "delete", "get", "list", "patch", "update", "watch"],
          },
        ],
      });
    });
  });

  describe("getClusterRoleBindings", () => {
    test("Should generate a ClusterRoleBinding", () => {
      const result = getClusterRoleBindings("test-cluster-role-binding");
      expect(result).toEqual({
        apiVersion: "rbac.authorization.k8s.io/v1",
        kind: "ClusterRoleBinding",
        metadata: { name: "test-cluster-role-binding" },
        roleRef: {
          apiGroup: "rbac.authorization.k8s.io",
          kind: "ClusterRole",
          name: "test-cluster-role-binding",
        },
        subjects: [
          {
            kind: "ServiceAccount",
            name: "test-cluster-role-binding",
            namespace: "pepr-system",
          },
        ],
      });
    });
  });

  describe("getServiceAccounts", () => {
    test("Should generate a ServiceAccount", () => {
      const result = getServiceAccounts("test-service-account");
      expect(result).toEqual({
        apiVersion: "v1",
        kind: "ServiceAccount",
        metadata: {
          name: "test-service-account",
          namespace: "pepr-system",
        },
      });
    });
  });

  describe("getStoreRoles", () => {
    test("Should generate a Role with store-specific permissions", () => {
      const result = getStoreRoles("test-role");
      expect(result).toEqual({
        apiVersion: "rbac.authorization.k8s.io/v1",
        kind: "Role",
        metadata: { name: "test-role-store", namespace: "pepr-system" },
        rules: [
          {
            apiGroups: ["pepr.dev"],
            resources: ["peprstores"],
            resourceNames: [""],
            verbs: ["create", "get", "patch", "watch"],
          },
        ],
      });
    });
  });

  describe("getStoreRoleBindings", () => {
    test("Should generate a RoleBinding with store-specific permissions", () => {
      const result = getStoreRoleBindings("test-role-binding");
      expect(result).toEqual({
        apiVersion: "rbac.authorization.k8s.io/v1",
        kind: "RoleBinding",
        metadata: { name: "test-role-binding-store", namespace: "pepr-system" },
        roleRef: {
          apiGroup: "rbac.authorization.k8s.io",
          kind: "Role",
          name: "test-role-binding-store",
        },
        subjects: [
          {
            kind: "ServiceAccount",
            name: "test-role-binding-store",
            namespace: "pepr-system",
          },
        ],
      });
    });
  });
});
