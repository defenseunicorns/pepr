// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import {
  V1ClusterRole,
  V1ClusterRoleBinding,
  V1Deployment,
  V1LabelSelectorRequirement,
  V1MutatingWebhookConfiguration,
  V1Namespace,
  V1Secret,
  V1Service,
  V1ServiceAccount,
  dumpYaml,
} from "@kubernetes/client-node";
import { gzipSync } from "zlib";
import { ModuleConfig } from "../types";
import { TLSOut, genTLS } from "./tls";

const peprIgnore: V1LabelSelectorRequirement = {
  key: "pepr.dev",
  operator: "NotIn",
  values: ["ignore"],
};

export class Webhook {
  private name: string;
  private image: string;
  private tls: TLSOut;

  constructor(private readonly config: ModuleConfig) {
    this.name = `pepr-${config.uuid}`;

    this.image = `ghcr.io/defenseunicorns/pepr-controller:${config.version}`;

    // Generate the ephemeral tls things
    this.tls = genTLS(this.name);
  }

  /** Generate the pepr-system namespace */
  namespace(): V1Namespace {
    return {
      apiVersion: "v1",
      kind: "Namespace",
      metadata: { name: "pepr-system" },
    };
  }

  /**
   * Grants the controller access to cluster resources beyond the mutating webhook.
   *
   * @todo: should dynamically generate this based on resources used by the module. will also need to explore how this should work for multiple modules.
   * @returns
   */
  clusterRole(): V1ClusterRole {
    return {
      apiVersion: "rbac.authorization.k8s.io/v1",
      kind: "ClusterRole",
      metadata: { name: this.name },
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

  clusterRoleBinding(): V1ClusterRoleBinding {
    const name = this.name;
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

  serviceAccount(): V1ServiceAccount {
    return {
      apiVersion: "v1",
      kind: "ServiceAccount",
      metadata: {
        name: this.name,
        namespace: "pepr-system",
      },
    };
  }

  tlsSecret(): V1Secret {
    return {
      apiVersion: "v1",
      kind: "Secret",
      metadata: {
        name: `${this.name}-tls`,
        namespace: "pepr-system",
      },
      type: "kubernetes.io/tls",
      data: {
        "tls.crt": this.tls.crt,
        "tls.key": this.tls.key,
      },
    };
  }

  mutatingWebhook(): V1MutatingWebhookConfiguration {
    const { name } = this;
    const ignore = [peprIgnore];

    // Add any namespaces to ignore
    if (this.config.alwaysIgnore.namespaces.length > 0) {
      ignore.push({
        key: "kubernetes.io/metadata.name",
        operator: "NotIn",
        values: this.config.alwaysIgnore.namespaces,
      });
    }

    return {
      apiVersion: "admissionregistration.k8s.io/v1",
      kind: "MutatingWebhookConfiguration",
      metadata: { name },
      webhooks: [
        {
          name: `${name}.pepr.dev`,
          admissionReviewVersions: ["v1", "v1beta1"],
          clientConfig: {
            caBundle: this.tls.ca,
            service: {
              name: this.name,
              namespace: "pepr-system",
              path: "/mutate",
            },
          },
          failurePolicy: "Ignore",
          matchPolicy: "Equivalent",
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

  deployment(): V1Deployment {
    return {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: {
        name: this.name,
        namespace: "pepr-system",
        labels: {
          app: this.name,
        },
      },
      spec: {
        replicas: 2,
        selector: {
          matchLabels: {
            app: this.name,
          },
        },
        template: {
          metadata: {
            labels: {
              app: this.name,
            },
          },
          spec: {
            priorityClassName: "system-node-critical",
            serviceAccountName: this.name,
            containers: [
              {
                name: "server",
                image: this.image,
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
                  secretName: `${this.name}-tls`,
                },
              },
            ],
          },
        },
      },
    };
  }

  service(): V1Service {
    return {
      apiVersion: "v1",
      kind: "Service",
      metadata: {
        name: this.name,
        namespace: "pepr-system",
      },
      spec: {
        selector: {
          app: this.name,
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

  moduleSecret(data: string): V1Secret {
    // Compress the data
    const compressed = gzipSync(data);
    return {
      apiVersion: "v1",
      kind: "Secret",
      metadata: {
        name: `${this.name}-module`,
        namespace: "pepr-system",
      },
      type: "Opaque",
      data: {
        module: compressed.toString("base64"),
      },
    };
  }

  zarfYaml(path: string) {
    const zarfCfg = {
      kind: "ZarfPackageConfig",
      metadata: {
        name: this.name,
        description: `Pepr Module: ${this.config.description}`,
        url: "https://github.com/defenseunicorns/pepr",
        version: this.config.version,
      },
      components: [
        {
          name: "module",
          required: true,
          manifests: [
            {
              name: "module",
              namespace: "pepr-system",
              files: [path],
            },
          ],
          images: [this.image],
        },
      ],
    };

    return dumpYaml(zarfCfg, { noRefs: true });
  }

  allYaml(code: string) {
    const resources = [
      this.namespace(),
      this.clusterRole(),
      this.clusterRoleBinding(),
      this.serviceAccount(),
      this.tlsSecret(),
      this.mutatingWebhook(),
      this.deployment(),
      this.service(),
      this.moduleSecret(code),
    ];

    // Convert the resources to a single YAML string
    return resources.map(r => dumpYaml(r, { noRefs: true })).join("---\n");
  }
}
