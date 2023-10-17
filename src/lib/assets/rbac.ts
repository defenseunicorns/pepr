// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { kind } from "kubernetes-fluent-client";
import { CapabilityExport } from "../types";
import { createRBACMap } from "../helpers";
/**
 * Grants the controller access to cluster resources beyond the mutating webhook.
 *
 * @todo: should dynamically generate this based on resources used by the module. will also need to explore how this should work for multiple modules.
 * @returns
 */
export function clusterRole(name: string, capabilities: CapabilityExport[]): kind.ClusterRole {
  console.log(`Let's give this SA the least privileges possible.\n${JSON.stringify(capabilities, null, 2)}`);
  const rbacMap = createRBACMap(capabilities);
  return {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "ClusterRole",
    metadata: { name },
    rules: [
      ...Object.keys(rbacMap).map(key => {
        // let group:string, version:string, kind:string;
        let group: string;

        if (key.split("/").length < 3) {
          group = "";
          // version = key.split("/")[0]
          // kind = key.split("/")[1]
        } else {
          group = key.split("/")[0];
          // version = key.split("/")[1]
          // kind = key.split("/")[2]
        }

        return {
          apiGroups: [group],
          resources: [rbacMap[key].plural],
          verbs: rbacMap[key].verbs,
        };
      }),
      // {
      //   // @todo: make this configurable
      //   apiGroups: ["*"],
      //   resources: ["*"],
      //   verbs: ["create", "delete", "get", "list", "patch", "update", "watch"],
      // },
    ],
  };
}

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

export function storeRole(name: string): kind.Role {
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
