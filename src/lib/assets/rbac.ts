// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { V1ClusterRole, V1ClusterRoleBinding, V1Role, V1RoleBinding, V1ServiceAccount } from "@kubernetes/client-node";

/**
 * Grants the controller access to cluster resources beyond the mutating webhook.
 *
 * @todo: should dynamically generate this based on resources used by the module. will also need to explore how this should work for multiple modules.
 * @returns
 */
export function clusterRole(name: string): V1ClusterRole {
  return {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "ClusterRole",
    metadata: { name },
    rules: [
      {
        // @todo: make this configurable
        apiGroups: ["*"],
        resources: ["*"],
        verbs: ["create", "delete", "get", "list", "patch", "update", "watch"],
      },
    ],
  };
}

export function clusterRoleBinding(name: string): V1ClusterRoleBinding {
  return {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "ClusterRoleBinding",
    metadata: { name },
    roleRef: {
      apiGroup: "rbac.authorization.k8s.io",
      kind: "ClusterRole",
      name,
    },
    subjects: [
      {
        kind: "ServiceAccount",
        name,
        namespace: "pepr-system",
      },
    ],
  };
}

export function serviceAccount(name: string): V1ServiceAccount {
  return {
    apiVersion: "v1",
    kind: "ServiceAccount",
    metadata: {
      name,
      namespace: "pepr-system",
    },
  };
}

export function storeRole(name: string): V1Role {
  name = `${name}-store`;
  return {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "Role",
    metadata: { name, namespace: "pepr-system" },
    rules: [
      {
        apiGroups: ["pepr.dev/*"],
        resources: ["peprstores"],
        resourceNames: [""],
        verbs: ["create", "get", "patch", "watch"],
      },
    ],
  };
}

export function storeRoleBinding(name: string): V1RoleBinding {
  name = `${name}-store`;
  return {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "RoleBinding",
    metadata: { name, namespace: "pepr-system" },
    roleRef: {
      apiGroup: "rbac.authorization.k8s.io",
      kind: "Role",
      name,
    },
    subjects: [
      {
        kind: "ServiceAccount",
        name,
        namespace: "pepr-system",
      },
    ],
  };
}
