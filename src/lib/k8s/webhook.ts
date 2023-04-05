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
import { gzipSync } from "zlib";
import { tlsCA, tlsCert, tlsKey } from "./stub-tls";
import { ModuleConfig } from "../types";

const peprIgnore = {
  key: "pepr.dev",
  operator: "NotIn",
  values: ["ignore"],
};

// @todo: make all this 💩 real

/**
 * Grants the controller access to cluster resources beyond the mutating webhook.
 *
 * @todo: should dynamically generate this based on resources used by the module. will also need to explore how this should work for multiple modules.
 * @returns
 */
export function role(config: ModuleConfig): V1ClusterRole {
  return {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "ClusterRole",
    metadata: {
      name: `pepr-${config.uuid}`,
    },
    rules: [
      {
        // @todo: make this configurable
        apiGroups: ["*"],
        resources: ["*"],
        verbs: ["create", "delete", "get", "list", "patch", "update", "watch"],
      },
      {
        apiGroups: ["admissionregistration.k8s.io/v1"],
        resources: ["mutatingwebhookconfigurations", "validatingwebhookconfigurations"],
        verbs: ["get", "list", "update"],
      },
    ],
  };
}

export function roleBinding(config: ModuleConfig): V1ClusterRoleBinding {
  const name = `pepr-${config.uuid}`;
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

export function mutatingWebhook(config: ModuleConfig): V1MutatingWebhookConfiguration {
  const name = `pepr-${config.uuid}`;

  const ignore = [peprIgnore];
  if (config.alwaysIgnore.kinds.length > 0) {
    // ignore.push({
    //   key: "pepr.dev/kind",
    //   operator: "NotIn",
    //   values: config.alwaysIgnore.kinds,
    // });
  }

  // Add any namespaces to ignore
  if (config.alwaysIgnore.namespaces.length > 0) {
    ignore.push({
      key: "kubernetes.io/metadata.name",
      operator: "NotIn",
      values: config.alwaysIgnore.namespaces,
    });
  }

  return {
    apiVersion: "admissionregistration.k8s.io/v1",
    kind: "MutatingWebhookConfiguration",
    metadata: { name },
    webhooks: [
      {
        admissionReviewVersions: ["v1", "v1beta1"],
        clientConfig: {
          caBundle: tlsCA(),
          service: {
            name: "controller",
            namespace: "pepr-system",
            path: "/mutate",
          },
        },
        failurePolicy: "Ignore",
        matchPolicy: "Equivalent",
        name,
        timeoutSeconds: 15,
        namespaceSelector: {
          matchExpressions: ignore,
        },
        objectSelector: {
          matchExpressions: ignore,
        },
        // @todo: make this configurable
        rules: [
          {
            apiGroups: ["*"],
            apiVersions: ["*"],
            operations: ["CREATE", "UPDATE", "DELETE"],
            resources: ["*"],
          },
        ],
        // @todo: track side effects state
        sideEffects: "None",
      },
    ],
  };
}

export function deployment(config: ModuleConfig): V1Deployment {
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
          serviceAccountName: `pepr-${config.uuid}`,
          containers: [
            {
              name: "server",
              image: "ghcr.io/defenseunicorns/pepr-controller:latest",
              imagePullPolicy: "IfNotPresent",
              livenessProbe: {
                httpGet: {
                  path: "/healthz",
                  port: 3000,
                  scheme: "HTTPS",
                },
              },
              ports: [
                {
                  containerPort: 3000,
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
          targetPort: 3000,
        },
      ],
    },
  };
}

export function moduleSecret(uuid: string, data: string): V1Secret {
  // Compress the data
  const compressed = gzipSync(data);
  return {
    apiVersion: "v1",
    kind: "Secret",
    metadata: {
      name: `module-${uuid}`,
      namespace: "pepr-system",
    },
    type: "Opaque",
    data: {
      module: compressed.toString("base64"),
    },
  };
}
