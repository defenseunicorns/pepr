// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { clusterRole, clusterRoleBinding, storeRole, serviceAccount, storeRoleBinding } from "./rbac";
import { it, describe, expect, beforeEach, jest } from "@jest/globals";
import { V1PolicyRule as PolicyRule } from "@kubernetes/client-node";
import fs from "fs";
import { mockCapabilities } from "./defaultTestObjects";

describe("RBAC generation with mocked package.json", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(fs, "readFileSync").mockImplementation((path: unknown) => {
      if (typeof path === "string" && path.includes("package.json")) {
        return JSON.stringify({
          pepr: {
            rbac: [
              {
                apiGroups: ["pepr.dev"],
                resources: ["pods"],
                verbs: ["get", "list"],
              },
              {
                apiGroups: ["pepr.dev"],
                resources: ["pods"],
                verbs: ["list"],
              },
              {
                apiGroups: ["apps"],
                resources: ["deployments"],
                verbs: ["create", "delete"],
              },
            ],
          },
        });
      }
      return "{}";
    });
  });

  it("should generate a ClusterRole with wildcard rules when not in scoped mode", () => {
    const expectedWildcardRules = [
      {
        apiGroups: ["*"],
        resources: ["*"],
        verbs: ["create", "delete", "get", "list", "patch", "update", "watch"],
      },
    ];

    const result = clusterRole(
      "test-role",
      mockCapabilities,
      "admin",
      mockCapabilities.flatMap(c => c.rbac).filter((rule): rule is PolicyRule => rule !== undefined),
    );

    expect(result.rules).toEqual(expectedWildcardRules);
  });
});

describe("clusterRoleBinding", () => {
  it("should create a ClusterRoleBinding with the specified name", () => {
    const roleName = "test-cluster-role";
    const expectedClusterRoleBinding = {
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
});

describe("serviceAccount", () => {
  it("should create a ServiceAccount with the specified name", () => {
    const accountName = "test-service-account";
    const expectedServiceAccount = {
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

describe("storeRole", () => {
  it("should create a Role for managing peprstores with the specified name", () => {
    const roleName = "test-role";
    const expectedRole = {
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
});

describe("storeRoleBinding", () => {
  it("should create a RoleBinding for the specified Role", () => {
    const roleName = "test-role";
    const expectedRoleBinding = {
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
});
