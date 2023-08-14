// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { V1Deployment, V1Namespace, V1Secret } from "@kubernetes/client-node";
import { gzipSync } from "zlib";
import { Assets } from ".";
import { Binding } from "../types";

/** Generate the pepr-system namespace */
export const namespace: V1Namespace = {
  apiVersion: "v1",
  kind: "Namespace",
  metadata: { name: "pepr-system" },
};

export function watcher(assets: Assets, hash: string) {
  const { name, image, capabilities } = assets;

  // Append the watcher suffix
  const app = `${name}-watcher`;
  const bindings: Binding[] = [];

  // Loop through the capabilities and find any Watch CapabilityActions
  for (const capability of capabilities) {
    const watchers = capability._bindings.filter(binding => binding.isWatch);
    bindings.push(...watchers);
  }

  // If there are no watchers, don't deploy the watcher
  if (bindings.length < 1) {
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
        },
      },
      template: {
        metadata: {
          labels: {
            app,
          },
        },
        spec: {
          serviceAccountName: name,
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
              env: [{ name: "PEPR_WATCH_MODE", value: "true" }],
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

export function deployment(assets: Assets, hash: string): V1Deployment {
  const { name, image } = assets;
  const app = name;

  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name,
      namespace: "pepr-system",
      labels: {
        app,
      },
    },
    spec: {
      replicas: 2,
      selector: {
        matchLabels: {
          app,
        },
      },
      template: {
        metadata: {
          labels: {
            app,
          },
        },
        spec: {
          priorityClassName: "system-node-critical",
          serviceAccountName: name,
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

export function moduleSecret(name: string, data: Buffer, hash: string): V1Secret {
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
