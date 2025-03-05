// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { clusterRole, clusterRoleBinding, storeRole, serviceAccount, storeRoleBinding } from "./rbac";
import { it, describe, expect, jest } from "@jest/globals";
import { V1PolicyRule as PolicyRule } from "@kubernetes/client-node";
import fs from "fs";
import { kind } from "kubernetes-fluent-client";
import * as helpers from "../helpers";
import {
  capabilityWithDuplicates,
  mockCapabilities,
  capabilityWithFinalize,
  capabilityWithLongKey,
  capabilityWithShortKey,
} from "./defaultTestObjects";

describe("RBAC Resource Creation", () => {
  it("should create a ClusterRoleBinding with the specified name", () => {
    const roleName = "test-cluster-role";
    const expectedClusterRoleBinding: kind.ClusterRoleBinding = {
      apiVersion: "rbac.authorization.k8s.io/v1",
      kind: "ClusterRoleBinding",
      metadata: { name: roleName },
      roleRef: {
        apiGroup: "rbac.authorization.k8s.io",
        kind: "ClusterRole",
        name: roleName,
      },
      subjects: [
        {
          kind: "ServiceAccount",
          name: roleName,
          namespace: "pepr-system",
        },
      ],
    };

    const result = clusterRoleBinding(roleName);

    expect(result).toEqual(expectedClusterRoleBinding);
  });

  it("should create a Role for managing peprstores with the specified name", () => {
    const roleName = "test-role";
    const expectedRole: kind.Role = {
      apiVersion: "rbac.authorization.k8s.io/v1",
      kind: "Role",
      metadata: {
        name: `${roleName}-store`,
        namespace: "pepr-system",
      },
      rules: [
        {
          apiGroups: ["pepr.dev"],
          resources: ["peprstores"],
          resourceNames: [""],
          verbs: ["create", "get", "patch", "watch"],
        },
      ],
    };

    const result = storeRole(roleName);

    expect(result).toEqual(expectedRole);
  });

  it("should create a RoleBinding for the specified Role", () => {
    const roleName = "test-role";
    const expectedRoleBinding: kind.RoleBinding = {
      apiVersion: "rbac.authorization.k8s.io/v1",
      kind: "RoleBinding",
      metadata: {
        name: `${roleName}-store`,
        namespace: "pepr-system",
      },
      roleRef: {
        apiGroup: "rbac.authorization.k8s.io",
        kind: "Role",
        name: `${roleName}-store`,
      },
      subjects: [
        {
          kind: "ServiceAccount",
          name: `${roleName}-store`,
          namespace: "pepr-system",
        },
      ],
    };

    const result = storeRoleBinding(roleName);

    expect(result).toEqual(expectedRoleBinding);
  });

  it("should create a ServiceAccount with the specified name", () => {
    const accountName = "test-service-account";
    const expectedServiceAccount: kind.ServiceAccount = {
      apiVersion: "v1",
      kind: "ServiceAccount",
      metadata: {
        name: accountName,
        namespace: "pepr-system",
      },
    };

    const result = serviceAccount(accountName);

    expect(result).toEqual(expectedServiceAccount);
  });
});

describe("RBAC Rule Processing", () => {
  it("should deduplicate verbs and resources in rules", () => {
    const result = clusterRole(
      "test-role",
      capabilityWithDuplicates,
      "scoped",
      capabilityWithDuplicates.flatMap(c => c.rbac).filter((rule): rule is PolicyRule => rule !== undefined),
    );

    // Filter out only the rules for 'pepr.dev' and 'peprstores'
    const filteredRules = result.rules?.filter(
      rule => rule.apiGroups?.includes("pepr.dev") && rule.resources?.includes("peprstores"),
    );

    expect(filteredRules).toEqual([
      {
        apiGroups: ["pepr.dev"],
        resources: ["peprstores"],
        verbs: ["create", "get", "patch", "watch"],
      },
    ]);
  });
  it("should default to an empty verbs array if rule.verbs is undefined", () => {
    // Simulate a custom RBAC rule with empty verbs
    const customRbacWithNoVerbs: PolicyRule[] = [
      {
        apiGroups: ["pepr.dev"],
        resources: ["customresources"],
        verbs: [], // Set verbs to an empty array to satisfy the V1PolicyRule type
      },
    ];

    jest.spyOn(fs, "readFileSync").mockImplementation(() => {
      return JSON.stringify({
        pepr: {
          rbac: customRbacWithNoVerbs,
        },
      });
    });

    const result = clusterRole("test-role", mockCapabilities, "scoped", customRbacWithNoVerbs);

    // Check that the verbs array is empty for the custom RBAC rule
    expect(result.rules).toContainEqual({
      apiGroups: ["pepr.dev"],
      resources: ["customresources"],
      verbs: [],
    });
  });
  it("should handle non-array custom RBAC by defaulting to an empty array", () => {
    // Mock readRBACFromPackageJson to return a non-array value
    jest.spyOn(fs, "readFileSync").mockImplementation(() => {
      return JSON.stringify({
        pepr: {
          rbac: "not-an-array", // Simulate invalid RBAC structure
        },
      });
    });

    const expected: PolicyRule[] = [
      {
        apiGroups: ["pepr.dev"],
        resources: ["peprstores"],
        verbs: ["create", "get", "patch", "watch"],
      },
      {
        apiGroups: ["apiextensions.k8s.io"],
        resources: ["customresourcedefinitions"],
        verbs: ["patch", "create"],
      },
      {
        apiGroups: [""],
        resources: ["namespaces"],
        verbs: ["watch"],
      },
      {
        apiGroups: [""],
        resources: ["configmaps"],
        verbs: ["watch"],
      },
    ];

    const result = clusterRole(
      "test-role",
      mockCapabilities,
      "scoped",
      mockCapabilities.flatMap(c => c.rbac).filter((rule): rule is PolicyRule => rule !== undefined),
    );

    // The result should only contain rules from the capabilities, not from the invalid custom RBAC
    expect(result.rules).toEqual(expected);
  });
});

describe("ClusterRole Generation", () => {
  it("should generate a ClusterRole with wildcard rules when not in scoped mode", () => {
    const expectedWildcardRules = [
      {
        apiGroups: ["*"],
        resources: ["*"],
        verbs: ["create", "delete", "get", "list", "patch", "update", "watch"],
      },
    ];

    const result = clusterRole("test-role", mockCapabilities, "admin", []);

    expect(result.rules).toEqual(expectedWildcardRules);
  });
  it("should generate correct ClusterRole rules in scoped mode", () => {
    const expected: PolicyRule[] = [
      {
        apiGroups: ["pepr.dev"],
        resources: ["peprstores"],
        verbs: ["create", "get", "patch", "watch"],
      },
      {
        apiGroups: ["apiextensions.k8s.io"],
        resources: ["customresourcedefinitions"],
        verbs: ["patch", "create"],
      },
      {
        apiGroups: [""],
        resources: ["namespaces"],
        verbs: ["watch"],
      },
      {
        apiGroups: [""],
        resources: ["configmaps"],
        verbs: ["watch"],
      },
    ];
    const result = clusterRole("test-role", mockCapabilities, "scoped", []);

    expect(result.rules).toEqual(expected);
  });

  it("should include finalize verbs if isFinalize is true in scoped mode", () => {
    const expected: PolicyRule[] = [
      {
        apiGroups: ["pepr.dev"],
        resources: ["peprstores"],
        verbs: ["patch"],
      },
      {
        apiGroups: ["apiextensions.k8s.io"],
        resources: ["customresourcedefinitions"],
        verbs: ["patch", "create"],
      },
    ];

    const result = clusterRole(
      "test-role",
      capabilityWithFinalize,
      "scoped",
      capabilityWithFinalize.flatMap(c => c.rbac).filter((rule): rule is PolicyRule => rule !== undefined),
    );

    expect(result.rules).toEqual(expected);
  });
  it("should return an empty rules array when capabilities are empty in scoped mode", () => {
    const result = clusterRole("test-role", [], "scoped", []);

    expect(result.rules).toEqual([]);
  });
});

describe("RBAC Key Handling", () => {
  it("should handle keys with 3 or more segments and set group correctly", () => {
    jest.spyOn(helpers, "createRBACMap").mockReturnValue({
      "apps/v1/deployments": {
        plural: "deployments",
        verbs: ["create"],
      },
    });

    const expected: PolicyRule[] = [
      {
        apiGroups: ["apps"],
        resources: ["deployments"],
        verbs: ["create"],
      },
    ];

    const result = clusterRole(
      "test-role",
      capabilityWithLongKey,
      "scoped",
      capabilityWithLongKey.flatMap(c => c.rbac).filter((rule): rule is PolicyRule => rule !== undefined),
    );

    expect(result.rules).toEqual(expected);
  });

  it("should handle keys with less than 3 segments and set group to an empty string", () => {
    jest.spyOn(helpers, "createRBACMap").mockReturnValue({
      nodes: {
        plural: "nodes",
        verbs: ["get"],
      },
    });

    const expected: PolicyRule[] = [
      {
        apiGroups: [""],
        resources: ["nodes"],
        verbs: ["get"],
      },
    ];
    const result = clusterRole(
      "test-role",
      capabilityWithShortKey,
      "scoped",
      capabilityWithShortKey.flatMap(c => c.rbac).filter((rule): rule is PolicyRule => rule !== undefined),
    );

    expect(result.rules).toEqual(expected);
  });
});
