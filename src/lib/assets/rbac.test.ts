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
  getRBACConfig,
  getServiceAccounts,
  getStoreRoles,
  getStoreRoleBindings,
  validateRoleEntries,
  validateRoleItem,
} from "./rbac";
import { CapabilityExport } from "../types";
import { V1ClusterRole, V1Role } from "@kubernetes/client-node";

type KubernetesResource = V1ClusterRole | V1Role;

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

  describe("getCustomClusterRoleRules", () => {
    test("Should add verbs to existing rule entry in cluster role rules", () => {
      const mockPackageData = {
        pepr: {
          rbac: {
            clusterRoles: [
              { rules: [{ apiGroups: [""], resources: ["nodes"], verbs: ["get"] }] },
              { rules: [{ apiGroups: [""], resources: ["nodes"], verbs: ["list"] }] },
            ],
          },
        },
      };

      const result = getCustomClusterRoleRules(mockPackageData);
      expect(result).toEqual([
        {
          apiGroups: [""],
          resources: ["nodes"],
          verbs: ["get", "list"], // Ensures verbs are added to the existing rule entry
        },
      ]);
    });
  });

  describe("getCustomStoreRoleRules", () => {
    test("Should add verbs to existing rule entry in store role rules", () => {
      const mockPackageData = {
        pepr: {
          rbac: {
            roles: [
              { rules: [{ apiGroups: ["apps"], resources: ["deployments"], verbs: ["create"] }] },
              { rules: [{ apiGroups: ["apps"], resources: ["deployments"], verbs: ["update"] }] },
            ],
          },
        },
      };

      const result = getCustomStoreRoleRules(mockPackageData);
      expect(result).toEqual([
        {
          apiGroups: ["apps"],
          resources: ["deployments"],
          verbs: ["create", "update"], // Ensures verbs are added to the existing rule entry
        },
      ]);
    });
  });

  describe("validateRoleEntries", () => {
    test("Should log warning when roles are not an array", () => {
      const invalidRoles = {} as unknown; // Not an array
      const result = validateRoleEntries(invalidRoles as (V1ClusterRole | V1Role)[], "roles");
      expect(result).toEqual([]);
      expect(Log.warn).toHaveBeenCalledWith("Invalid roles entries: Expected an array but got object");
    });

    test("Should log warning when role entry is missing rules array", () => {
      const rolesWithMissingRules: Partial<V1Role>[] = [{ metadata: { name: "test-role" } }];
      const result = validateRoleEntries(rolesWithMissingRules, "roles");
      expect(result).toEqual([]);
      expect(Log.warn).toHaveBeenCalledWith("Invalid roles entry: Missing required 'rules' array");
    });
  });

  describe("validateRoleItem", () => {
    test("Should log warning when role item is not an object", () => {
      const invalidRole = "not-an-object" as unknown;
      const result = validateRoleItem(invalidRole as KubernetesResource, "role");
      expect(result).toBe(false);
      expect(Log.warn).toHaveBeenCalledWith("Invalid role item: Expected an object but got string");
    });
  });

  describe("getRBACConfig", () => {
    test("Should log info and return empty RBAC configuration when RBAC is missing", () => {
      const peprConfig = {};
      const result = getRBACConfig(peprConfig);
      expect(result).toEqual({ roles: [], clusterRoles: [] });
      expect(Log.info).toHaveBeenCalledWith("Missing RBAC configuration in package.json.");
    });
  });

  describe("getClusterRoles", () => {
    test("Should add verbs to existing rule entry in scoped ClusterRole", () => {
      const capabilities: CapabilityExport[] = [
        {
          apiGroups: ["apps"],
          resources: ["deployments"],
          verbs: ["create"],
          bindings: [],
          hasSchedule: false,
          name: "",
          description: "",
        },
        {
          apiGroups: ["apps"],
          resources: ["deployments"],
          verbs: ["update"],
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
  });

  describe("getCustomClusterRoleRules", () => {
    test("Should handle undefined customClusterRoles gracefully", () => {
      const mockPackageData = { pepr: { rbac: {} } }; // No clusterRoles defined
      const result = getCustomClusterRoleRules(mockPackageData);
      expect(result).toEqual([]); // Should return an empty array
    });

    test("Should handle missing rules in cluster role gracefully", () => {
      const mockPackageData = {
        pepr: {
          rbac: {
            clusterRoles: [{ metadata: { name: "test-cluster-role" } }], // No rules field
          },
        },
      };

      const result = getCustomClusterRoleRules(mockPackageData);
      expect(result).toEqual([]); // Should return an empty array because rules are missing
    });
  });

  describe("getCustomStoreRoleRules", () => {
    test("Should handle undefined customRoles gracefully", () => {
      const mockPackageData = { pepr: { rbac: {} } }; // No roles defined
      const result = getCustomStoreRoleRules(mockPackageData);
      expect(result).toEqual([]); // Should return an empty array
    });

    test("Should handle missing rules in store role gracefully", () => {
      const mockPackageData = {
        pepr: {
          rbac: {
            roles: [{ metadata: { name: "test-role" } }], // No rules field
          },
        },
      };

      const result = getCustomStoreRoleRules(mockPackageData);
      expect(result).toEqual([]); // Should return an empty array because rules are missing
    });
  });

  describe("readCustomRBAC", () => {
    test("Should log error and return empty RBAC configuration on exception", () => {
      jest.spyOn(fs, "readFileSync").mockImplementation(() => {
        throw new Error("Simulated file read error");
      });

      const logErrorSpy = jest.spyOn(Log, "error").mockImplementation(() => {});
      const result = readCustomRBAC();

      expect(result).toEqual({ roles: [], clusterRoles: [] }); // Should return empty RBAC configuration
      expect(logErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Simulated file read error"));
    });
  });

  describe("readPackageJson", () => {
    test("Should throw an error when unable to read or parse package.json", () => {
      jest.spyOn(fs, "readFileSync").mockImplementation(() => {
        throw new Error("Simulated file read error");
      });

      expect(() => readPackageJson()).toThrow("Error reading or parsing package.json: Simulated file read error");
    });

    test("Should handle non-Error objects thrown during read", () => {
      jest.spyOn(fs, "readFileSync").mockImplementation(() => {
        throw "Simulated non-Error exception";
      });

      expect(() => readPackageJson()).toThrow("Error reading or parsing package.json: Simulated non-Error exception");
    });
  });
});
