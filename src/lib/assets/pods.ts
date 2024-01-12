// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { V1EnvVar } from "@kubernetes/client-node";
import { kind } from "kubernetes-fluent-client";
import { gzipSync } from "zlib";

import { Assets } from ".";
import { ModuleConfig } from "../module";
import { Binding } from "../types";

/** Generate the pepr-system namespace */
export const namespace: kind.Namespace = {
  apiVersion: "v1",
  kind: "Namespace",
  metadata: { name: "pepr-system" },
};

export function watcher(assets: Assets, hash: string) {
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

  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name: app,
      namespace: "pepr-system",
      labels: {
        app,
        "pepr.dev/controller": "watcher",
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
            buildTimestamp: `${Date.now()}`,
          },
          labels: {
            app,
            "pepr.dev/controller": "watcher",
          },
        },
        spec: {
          serviceAccountName: name,
          securityContext: {
            runAsUser: 65532,
            runAsGroup: 65532,
            runAsNonRoot: true,
            fsGroup: 65532,
          },
          containers: [
            {
              name: "watcher",
              image,
              imagePullPolicy: "IfNotPresent",
              command: ["node", "/app/node_modules/pepr/dist/controller.js", hash],
              readinessProbe: {
                httpGet: {
                  path: "/healthz",
                  port: 3000,
                  scheme: "HTTPS",
                },
              },
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
              securityContext: {
                runAsUser: 65532,
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
}

export function deployment(assets: Assets, hash: string): kind.Deployment {
  const { name, image, config } = assets;
  const app = name;

  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name,
      namespace: "pepr-system",
      labels: {
        app,
        "pepr.dev/controller": "admission",
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
            buildTimestamp: `${Date.now()}`,
          },
          labels: {
            app,
            "pepr.dev/controller": "admission",
          },
        },
        spec: {
          priorityClassName: "system-node-critical",
          serviceAccountName: name,
          securityContext: {
            runAsUser: 65532,
            runAsGroup: 65532,
            runAsNonRoot: true,
            fsGroup: 65532,
          },
          containers: [
            {
              name: "server",
              image,
              imagePullPolicy: "IfNotPresent",
              command: ["node", "/app/node_modules/pepr/dist/controller.js", hash],
              readinessProbe: {
                httpGet: {
                  path: "/healthz",
                  port: 3000,
                  scheme: "HTTPS",
                },
              },
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
              env: genEnv(config),
              securityContext: {
                runAsUser: 65532,
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
                  name: "api-token",
                  mountPath: "/app/api-token",
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
              name: "api-token",
              secret: {
                secretName: `${name}-api-token`,
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
}

export function moduleSecret(name: string, data: Buffer, hash: string): kind.Secret {
  // Compress the data
  const compressed = gzipSync(data);
  const path = `module-${hash}.js.gz`;
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

function genEnv(config: ModuleConfig, watchMode = false): V1EnvVar[] {
  const env = [
    { name: "PEPR_WATCH_MODE", value: watchMode ? "true" : "false" },
    { name: "PEPR_PRETTY_LOG", value: "false" },
    { name: "LOG_LEVEL", value: config.logLevel || "debug" },
  ];

  if (config.env) {
    for (const [name, value] of Object.entries(config.env)) {
      env.push({ name, value });
    }
  }

  return env;
}
