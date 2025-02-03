// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { kind } from "kubernetes-fluent-client";
import { V1PolicyRule as PolicyRule } from "@kubernetes/client-node";
import { CapabilityExport } from "../types";
import { createRBACMap } from "../helpers";

/**
 * Creates a Kubernetes ClusterRole based on capabilities and optional custom RBAC rules.
 *
 * @param {string} name - The name of the ClusterRole.
 * @param {CapabilityExport[]} capabilities - Array of capabilities defining RBAC rules.
 * @param {string} [rbacMode=""] - The RBAC mode; if "scoped", generates scoped rules, otherwise uses wildcard rules.
 * @returns {kind.ClusterRole} - A Kubernetes ClusterRole object.
 */
export function clusterRole(
  name: string,
  capabilities: CapabilityExport[],
  rbacMode: string = "admin",
  customRbac: PolicyRule[] | undefined,
): kind.ClusterRole {
  // Create the RBAC map from capabilities
  const rbacMap = createRBACMap(capabilities);
  // Generate scoped rules from rbacMap
  const scopedRules = Object.keys(rbacMap).map(key => {
    const group: string = key.split("/").length < 3 ? "" : key.split("/")[0];

    return {
      apiGroups: [group],
      resources: [rbacMap[key].plural],
      verbs: rbacMap[key].verbs,
    };
  });

  // Merge and deduplicate custom RBAC and scoped rules
  const mergedRBAC = [...(Array.isArray(customRbac) ? customRbac : []), ...scopedRules];
  const deduper: Record<string, PolicyRule & { verbs: string[] }> = {};

  mergedRBAC.forEach(rule => {
    const key = `${rule.apiGroups}/${rule.resources}`;
    if (deduper[key]) {
      // Deduplicate verbs
      deduper[key].verbs = Array.from(new Set([...deduper[key].verbs, ...rule.verbs]));
    } else {
      deduper[key] = { ...rule, verbs: rule.verbs || [] };
    }
  });

  // Convert deduplicated RBAC rules back to an array
  const deduplicatedRules = Object.values(deduper);

  return {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "ClusterRole",
    metadata: { name },
    rules:
      rbacMode === "scoped"
        ? deduplicatedRules
        : [
            {
              apiGroups: ["*"],
              resources: ["*"],
              verbs: ["create", "delete", "get", "list", "patch", "update", "watch"],
            },
          ],
  };
}

/**
 * Creates a Kubernetes ClusterRoleBinding for a specified ClusterRole.
 *
 * @param {string} name - The name of the ClusterRole to bind.
 * @returns {kind.ClusterRoleBinding} - A Kubernetes ClusterRoleBinding object.
 */
export function clusterRoleBinding(name: string): kind.ClusterRoleBinding {
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

/**
 * Creates a Kubernetes ServiceAccount with the specified name.
 *
 * @param {string} name - The name of the ServiceAccount.
 * @returns {kind.ServiceAccount} - A Kubernetes ServiceAccount object.
 */
export function serviceAccount(name: string): kind.ServiceAccount {
  return {
    apiVersion: "v1",
    kind: "ServiceAccount",
    metadata: {
      name,
      namespace: "pepr-system",
    },
  };
}

/**
 * Creates a Kubernetes Role for managing peprstores in a specified namespace.
 *
 * @param {string} name - The base name of the Role.
 * @returns {kind.Role} - A Kubernetes Role object for peprstores.
 */
export function storeRole(name: string): kind.Role {
  name = `${name}-store`;
  return {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "Role",
    metadata: { name, namespace: "pepr-system" },
    rules: [
      {
        apiGroups: ["pepr.dev"],
        resources: ["peprstores"],
        resourceNames: [""],
        verbs: ["create", "get", "patch", "watch"],
      },
    ],
  };
}

/**
 * Creates a Kubernetes RoleBinding for a specified Role in the pepr-system namespace.
 *
 * @param {string} name - The base name of the Role to bind.
 * @returns {kind.RoleBinding} - A Kubernetes RoleBinding object.
 */
export function storeRoleBinding(name: string): kind.RoleBinding {
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
