// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { KubernetesObject } from "@kubernetes/client-node";
import { kind } from "kubernetes-fluent-client";
import { gzipSync } from "zlib";
import { secretOverLimit } from "../helpers";
import { Assets } from "./assets";
import { Binding } from "../types";
import { genEnv } from "./envrionment";

/** Generate the pepr-system namespace */
export function getNamespace(namespaceLabels?: Record<string, string>): KubernetesObject {
  if (namespaceLabels) {
    return {
      apiVersion: "v1",
      kind: "Namespace",
      metadata: {
        name: "pepr-system",
        labels: namespaceLabels ?? {},
      },
    };
  } else {
    return {
      apiVersion: "v1",
      kind: "Namespace",
      metadata: {
        name: "pepr-system",
      },
    };
  }
}

export function getWatcher(
  assets: Assets,
  hash: string,
  buildTimestamp: string,
  imagePullSecret?: string,
): kind.Deployment | null {
  const { name, image, capabilities, config } = assets;

  let hasSchedule = false;

  // Append the watcher suffix
  const app = `${name}-watcher`;
  const bindings: Binding[] = [];

  // Loop through the capabilities and find any Watch Actions
  for (const capability of capabilities) {
    if (capability.hasSchedule) {
      hasSchedule = true;
    }
    const watchers = capability.bindings.filter(binding => binding.isWatch);
    bindings.push(...watchers);
  }

  // If there are no watchers, don't deploy the watcher
  if (bindings.length < 1 && !hasSchedule) {
    return null;
  }

  const deploy: kind.Deployment = {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name: app,
      namespace: "pepr-system",
      annotations: {
        "pepr.dev/description": config.description || "",
      },
      labels: {
        app,
        "pepr.dev/controller": "watcher",
        "pepr.dev/uuid": config.uuid,
      },
    },
    spec: {
      replicas: 1,
      strategy: {
        type: "Recreate",
      },
      selector: {
        matchLabels: {
          app,
          "pepr.dev/controller": "watcher",
        },
      },
      template: {
        metadata: {
          annotations: {
            buildTimestamp: `${buildTimestamp}`,
          },
          labels: {
            app,
            "pepr.dev/controller": "watcher",
          },
        },
        spec: {
          terminationGracePeriodSeconds: 5,
          serviceAccountName: name,
          securityContext: {
            runAsUser: image.includes("private") ? 1000 : 65532,
            runAsGroup: 65532,
            runAsNonRoot: true,
            fsGroup: 65532,
          },
          containers: [
            {
              name: "watcher",
              image,
              imagePullPolicy: "IfNotPresent",
              args: ["/app/node_modules/pepr/dist/controller.js", hash],
              readinessProbe: {
                httpGet: {
                  path: "/healthz",
                  port: 3000,
                  scheme: "HTTPS",
                },
                initialDelaySeconds: 10,
              },
              livenessProbe: {
                httpGet: {
                  path: "/healthz",
                  port: 3000,
                  scheme: "HTTPS",
                },
                initialDelaySeconds: 10,
              },
              ports: [
                {
                  containerPort: 3000,
                },
              ],
              resources: {
                requests: {
                  memory: "256Mi",
                  cpu: "200m",
                },
                limits: {
                  memory: "512Mi",
                  cpu: "500m",
                },
              },
              securityContext: {
                runAsUser: image.includes("private") ? 1000 : 65532,
                runAsGroup: 65532,
                runAsNonRoot: true,
                allowPrivilegeEscalation: false,
                capabilities: {
                  drop: ["ALL"],
                },
              },
              volumeMounts: [
                {
                  name: "tls-certs",
                  mountPath: "/etc/certs",
                  readOnly: true,
                },
                {
                  name: "module",
                  mountPath: `/app/load`,
                  readOnly: true,
                },
              ],
              env: genEnv(config, true),
            },
          ],
          volumes: [
            {
              name: "tls-certs",
              secret: {
                secretName: `${name}-tls`,
              },
            },
            {
              name: "module",
              secret: {
                secretName: `${name}-module`,
              },
            },
          ],
        },
      },
    },
  };

  if (imagePullSecret) {
    deploy.spec!.template.spec!.imagePullSecrets = [{ name: imagePullSecret }];
  }

  return deploy;
}

export function getDeployment(
  assets: Assets,
  hash: string,
  buildTimestamp: string,
  imagePullSecret?: string,
): kind.Deployment {
  const { name, image, config } = assets;
  const app = name;

  const deploy: kind.Deployment = {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name,
      namespace: "pepr-system",
      annotations: {
        "pepr.dev/description": config.description || "",
      },
      labels: {
        app,
        "pepr.dev/controller": "admission",
        "pepr.dev/uuid": config.uuid,
      },
    },
    spec: {
      replicas: 2,
      selector: {
        matchLabels: {
          app,
          "pepr.dev/controller": "admission",
        },
      },
      template: {
        metadata: {
          annotations: {
            buildTimestamp: `${buildTimestamp}`,
          },
          labels: {
            app,
            "pepr.dev/controller": "admission",
          },
        },
        spec: {
          terminationGracePeriodSeconds: 5,
          priorityClassName: "system-node-critical",
          serviceAccountName: name,
          securityContext: {
            runAsUser: image.includes("private") ? 1000 : 65532,
            runAsGroup: 65532,
            runAsNonRoot: true,
            fsGroup: 65532,
          },
          containers: [
            {
              name: "server",
              image,
              imagePullPolicy: "IfNotPresent",
              args: ["/app/node_modules/pepr/dist/controller.js", hash],
              readinessProbe: {
                httpGet: {
                  path: "/healthz",
                  port: 3000,
                  scheme: "HTTPS",
                },
                initialDelaySeconds: 10,
              },
              livenessProbe: {
                httpGet: {
                  path: "/healthz",
                  port: 3000,
                  scheme: "HTTPS",
                },
                initialDelaySeconds: 10,
              },
              ports: [
                {
                  containerPort: 3000,
                },
              ],
              resources: {
                requests: {
                  memory: "256Mi",
                  cpu: "200m",
                },
                limits: {
                  memory: "512Mi",
                  cpu: "500m",
                },
              },
              env: genEnv(config),
              securityContext: {
                runAsUser: image.includes("private") ? 1000 : 65532,
                runAsGroup: 65532,
                runAsNonRoot: true,
                allowPrivilegeEscalation: false,
                capabilities: {
                  drop: ["ALL"],
                },
              },
              volumeMounts: [
                {
                  name: "tls-certs",
                  mountPath: "/etc/certs",
                  readOnly: true,
                },
                {
                  name: "api-path",
                  mountPath: "/app/api-path",
                  readOnly: true,
                },
                {
                  name: "module",
                  mountPath: `/app/load`,
                  readOnly: true,
                },
              ],
            },
          ],
          volumes: [
            {
              name: "tls-certs",
              secret: {
                secretName: `${name}-tls`,
              },
            },
            {
              name: "api-path",
              secret: {
                secretName: `${name}-api-path`,
              },
            },
            {
              name: "module",
              secret: {
                secretName: `${name}-module`,
              },
            },
          ],
        },
      },
    },
  };

  if (imagePullSecret) {
    deploy.spec!.template.spec!.imagePullSecrets = [{ name: imagePullSecret }];
  }

  return deploy;
}

export function getModuleSecret(name: string, data: Buffer, hash: string): kind.Secret {
  // Compress the data
  const compressed = gzipSync(data);
  const path = `module-${hash}.js.gz`;
  const compressedData = compressed.toString("base64");
  if (secretOverLimit(compressedData)) {
    const error = new Error(`Module secret for ${name} is over the 1MB limit`);
    throw error;
  } else {
    return {
      apiVersion: "v1",
      kind: "Secret",
      metadata: {
        name: `${name}-module`,
        namespace: "pepr-system",
      },
      type: "Opaque",
      data: {
        [path]: compressed.toString("base64"),
      },
    };
  }
}
