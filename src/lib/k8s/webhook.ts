// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import {
  V1ClusterRole,
  V1ClusterRoleBinding,
  V1Deployment,
  V1MutatingWebhookConfiguration,
  V1Secret,
  V1Service,
  V1ServiceAccount,
} from "@kubernetes/client-node";
import { tlsCA, tlsCert, tlsKey } from "./stub-tls";

// @todo: make all this 💩 real

/**
 * Grants the controller access to cluster resources beyond the mutating webhook.
 *
 * @todo: should dynamically generate this based on resources used by the module. will also need to explore how this should work for multiple modules.
 * @returns
 */
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
        verbs: ["create", "delete", "get", "list", "patch", "update", "watch"],
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

export function serviceAccoutn(): V1ServiceAccount {
  return {
    apiVersion: "v1",
    kind: "ServiceAccount",
    metadata: {
      name: "pepr",
      namespace: "pepr-system",
    },
  };
}

export function tlsSecret(): V1Secret {
  return {
    apiVersion: "v1",
    kind: "Secret",
    metadata: {
      name: "controller-tls",
      namespace: "pepr-system",
    },
    type: "kubernetes.io/tls",
    data: {
      "tls.crt": tlsCert(),
      "tls.key": tlsKey(),
    },
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
          caBundle: tlsCA(),
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

export function deployment(): V1Deployment {
  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name: "controller",
      namespace: "pepr-system",
      labels: {
        app: "controller",
      },
    },
    spec: {
      replicas: 2,
      selector: {
        matchLabels: {
          app: "controller",
        },
      },
      template: {
        metadata: {
          labels: {
            app: "controller",
          },
        },
        spec: {
          priorityClassName: "system-node-critical",
          serviceAccountName: "pepr",
          containers: [
            {
              name: "server",
              image: "ghcr.io/defenseunicorns/pepr-controller:latest",
              imagePullPolicy: "IfNotPresent",
              livenessProbe: {
                httpGet: {
                  path: "/healthz",
                  port: 8443,
                  scheme: "HTTPS",
                },
              },
              ports: [
                {
                  containerPort: 8443,
                },
              ],
              resources: {
                requests: {
                  memory: "64Mi",
                  cpu: "100m",
                },
                limits: {
                  memory: "256Mi",
                  cpu: "500m",
                },
              },
              volumeMounts: [
                {
                  name: "tls-certs",
                  mountPath: "/etc/certs",
                  readOnly: true,
                },
              ],
            },
          ],
          volumes: [
            {
              name: "tls-certs",
              secret: {
                secretName: "controller-tls",
              },
            },
          ],
        },
      },
    },
  };
}

export function service(): V1Service {
  return {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name: "controller",
      namespace: "pepr-system",
    },
    spec: {
      selector: {
        app: "controller",
      },
      ports: [
        {
          port: 443,
          targetPort: 8443,
        },
      ],
    },
  };
}
