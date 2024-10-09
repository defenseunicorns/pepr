import {
  readCustomRBAC,
  getAllClusterRoles,
  getAllClusterRoleBindings,
  getAllServiceAccounts,
  getStoreRoles,
  getCustomRoles,
  getGeneratedRoleBindings,
} from "./rbac";
import { CapabilityExport } from "../types";
//import { kind } from "kubernetes-fluent-client";
import fs from "fs";
import path from "path";
import { jest, describe, beforeEach, it, expect } from "@jest/globals";

// Mock dependencies
jest.mock("fs");
jest.mock("path");
jest.mock("../logger");
jest.mock("../helpers", () => ({
  createRBACMap: jest.fn(() => ({})),
}));

describe("RBAC Module", () => {
  const mockPackageJson = {
    pepr: {
      rbac: {
        roles: [],
        clusterRoles: [],
        roleBindings: [],
        clusterRoleBindings: [],
        serviceAccounts: [],
        storeRoles: [],
        storeRoleBindings: [],
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockPackageJson));
    (path.resolve as jest.Mock).mockReturnValue("/mocked/path/package.json");
  });

  describe("readCustomRBAC", () => {
    it("should read and return the custom RBAC configuration", () => {
      const rbacConfig = readCustomRBAC();
      expect(rbacConfig).toEqual(mockPackageJson.pepr.rbac);
    });

    it("should return an empty RBAC configuration if an error occurs", () => {
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error("File read error");
      });
      const rbacConfig = readCustomRBAC();
      expect(rbacConfig).toEqual({
        roles: [],
        clusterRoles: [],
        roleBindings: [],
        clusterRoleBindings: [],
        serviceAccounts: [],
        storeRoles: [],
        storeRoleBindings: [],
      });
    });
  });

  describe("getAllClusterRoles", () => {
    it("should return an array of all ClusterRoles", () => {
      const capabilities: CapabilityExport[] = [];
      const clusterRoles = getAllClusterRoles("test-role", capabilities);
      expect(clusterRoles).toHaveLength(1);
      expect(clusterRoles[0]).toHaveProperty("kind", "ClusterRole");
    });
  });

  describe("getAllClusterRoleBindings", () => {
    it("should return an array of all ClusterRoleBindings", () => {
      const clusterRoleBindings = getAllClusterRoleBindings("test-binding");
      expect(clusterRoleBindings).toHaveLength(1);
      expect(clusterRoleBindings[0]).toHaveProperty("kind", "ClusterRoleBinding");
    });
  });

  describe("getAllServiceAccounts", () => {
    it("should return an array of all ServiceAccounts", () => {
      const serviceAccounts = getAllServiceAccounts("test-sa");
      expect(serviceAccounts).toHaveLength(1);
      expect(serviceAccounts[0]).toHaveProperty("kind", "ServiceAccount");
    });
  });

  describe("getStoreRoles", () => {
    it("should return a Role with store-specific permissions", () => {
      const storeRole = getStoreRoles("test-store");
      expect(storeRole).toHaveProperty("kind", "Role");
      expect(storeRole).toBeDefined();
      expect(storeRole.metadata).toBeDefined();
      expect(storeRole.metadata!.name).toBe("test-store-store");
    });
  });

  describe("getCustomRoles", () => {
    it("should return an array of custom Roles", () => {
      const customRoles = getCustomRoles();
      expect(customRoles).toEqual([]);
    });
  });

  describe("getGeneratedRoleBindings", () => {
    it("should return a generated RoleBinding with store-specific permissions", () => {
      const roleBinding = getGeneratedRoleBindings("test-binding");
      expect(roleBinding).toHaveProperty("kind", "RoleBinding");
    });
  });
});
