// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { V1ClusterRole, V1ClusterRoleBinding, V1MutatingWebhookConfiguration } from "@kubernetes/client-node";

// @todo: make all this 💩 real

export function role(): V1ClusterRole {
  return {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "ClusterRole",
    metadata: {
      name: "pepr-test",
    },
    rules: [
      {
        apiGroups: ["*"],
        resources: ["*"],
        verbs: ["*"],
      },
      {
        apiGroups: [""],
        resources: ["mutatingwebhookconfigurations", "validatingwebhookconfigurations"],
        verbs: ["get", "list", "update"],
      },
    ],
  };
}

export function roleBinding(): V1ClusterRoleBinding {
  return {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "ClusterRoleBinding",
    metadata: {
      name: "pepr-test",
    },
    roleRef: {
      apiGroup: "rbac.authorization.k8s.io",
      kind: "ClusterRole",
      name: "pepr-test",
    },
    subjects: [
      {
        kind: "ServiceAccount",
        name: "pepr",
        namespace: "pepr-system",
      },
    ],
  };
}

export function mutatingWebhook(): V1MutatingWebhookConfiguration {
  return {
    apiVersion: "admissionregistration.k8s.io/v1",
    kind: "MutatingWebhookConfiguration",
    metadata: {
      name: "pepr-test",
    },
    webhooks: [
      {
        admissionReviewVersions: ["v1", "v1beta1"],
        clientConfig: {
          caBundle: "Cg==",
          service: {
            name: "pepr",
            namespace: "pepr-system",
            path: "/mutate",
          },
        },
        failurePolicy: "Ignore",
        matchPolicy: "Equivalent",
        name: "pepr-test",
        namespaceSelector: {
          matchExpressions: [
            {
              key: "pepr.dev",
              operator: "NotIn",
              values: ["ignore"],
            },
          ],
        },
        objectSelector: {
          matchExpressions: [
            {
              key: "pepr.dev",
              operator: "NotIn",
              values: ["ignore"],
            },
          ],
        },
        rules: [
          {
            apiGroups: ["*"],
            apiVersions: ["*"],
            operations: ["CREATE", "UPDATE"],
            resources: ["*"],
          },
        ],
        sideEffects: "None",
      },
    ],
  };
}
