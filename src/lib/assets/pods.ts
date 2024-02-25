// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { V1EnvVar } from "@kubernetes/client-node";
import { kind } from "kubernetes-fluent-client";
import { gzipSync } from "zlib";
import { secretOverLimit } from "../helpers";
import { Assets } from ".";
import { ModuleConfig } from "../module";
import { Binding } from "../types";

/** Generate the pepr-system namespace */
export function namespace(namespaceLabels?: Record<string, string>) {
  return {
    apiVersion: "v1",
    kind: "Namespace",
    metadata: {
      name: "pepr-system",
      labels: namespaceLabels ?? {},
    },
  };
}

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

export function chartYaml(name: string, description: string){
  return `
    apiVersion: v2
    name: ${name}
    description: ${description}

    # A chart can be either an 'application' or a 'library' chart.
    #
    # Application charts are a collection of templates that can be packaged into versioned archives
    # to be deployed.
    #
    # Library charts provide useful utilities or functions for the chart developer. They're included as
    # a dependency of application charts to inject those utilities and functions into the rendering
    # pipeline. Library charts do not define any templates and therefore cannot be deployed.
    type: application

    # This is the chart version. This version number should be incremented each time you make changes
    # to the chart and its templates, including the app version.
    # Versions are expected to follow Semantic Versioning (https://semver.org/)
    version: 0.1.0

    # This is the version number of the application being deployed. This version number should be
    # incremented each time you make changes to the application. Versions are not expected to
    # follow Semantic Versioning. They should reflect the version the application is using.
    # It is recommended to use it with quotes.
    appVersion: "1.16.0"

  `
}

export function helmWatcherDeployment() {
  return `
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: pepr-{{ .Values.uuid }}-watcher
      namespace: pepr-system
      annotations:
        {{- toYaml .Values.admission.annotations | nindent 4 }}
      labels:
        {{- toYaml .Values.admission.labels | nindent 4 }}
    spec:
      replicas: 1
      strategy:
        type: Recreate
      selector:
        matchLabels:
          app: pepr-{{ .Values.uuid }}-watcher
          pepr.dev/controller: watcher
      template:
        metadata:
          labels:
            app: pepr-{{ .Values.uuid }}-watcher
            pepr.dev/controller: watcher
        spec:
          serviceAccountName: pepr-{{ .Values.uuid }}
          securityContext:
            {{- toYaml .Values.admission.securityContext | nindent 8 }}
          containers:
            - name: watcher
              image: {{ .Values.watcher.image }}
              imagePullPolicy: IfNotPresent
              command:
                - node
                - /app/node_modules/pepr/dist/controller.js
                - {{ .Values.watcher.image }}
              readinessProbe:
                httpGet:
                  path: /healthz
                  port: 3000
                  scheme: HTTPS
              livenessProbe:
                httpGet:
                  path: /healthz
                  port: 3000
                  scheme: HTTPS
              ports:
                - containerPort: 3000
                resources:
                {{- toYaml .Values.admission.resources | nindent 10 }}
              env:
                {{- toYaml .Values.admission.env | nindent 10 }}
              securityContext:
                {{- toYaml .Values.admission.containerSecurityContext | nindent 10 }}
              volumeMounts:
                - name: tls-certs
                  mountPath: /etc/certs
                  readOnly: true
                - name: module
                  mountPath: /app/load
                  readOnly: true
          volumes:
            - name: tls-certs
              secret:
                secretName: pepr-{{ .Values.uuid }}-tls
            - name: module
              secret:
                secretName: pepr-{{ .Values.uuid }}-module
  `
}
export function helmAdmissionDeployment() {
  return `
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: pepr-{{ .Values.uuid }}
      namespace: pepr-system
      annotations:
        {{- toYaml .Values.admission.annotations | nindent 4 }}
      labels:
        {{- toYaml .Values.admission.labels | nindent 4 }}
    spec:
      replicas: 2
      selector:
        matchLabels:
          app: pepr-{{ .Values.uuid }}
          pepr.dev/controller: admission
      template:
        metadata:
          annotations:
            
          labels:
            app: pepr-{{ .Values.uuid }}
            pepr.dev/controller: admission
        spec:
          priorityClassName: system-node-critical
          serviceAccountName: pepr-{{ .Values.uuid }}
          securityContext:
            {{- toYaml .Values.admission.securityContext | nindent 8 }}
          containers:
            - name: server
              image: {{ .Values.admission.image }}
              imagePullPolicy: IfNotPresent
              command:
                - node
                - /app/node_modules/pepr/dist/controller.js
                - {{ .Values.hash }}
              readinessProbe:
                httpGet:
                  path: /healthz
                  port: 3000
                  scheme: HTTPS
              livenessProbe:
                httpGet:
                  path: /healthz
                  port: 3000
                  scheme: HTTPS
              ports:
                - containerPort: 3000
              resources:
                {{- toYaml .Values.admission.resources | nindent 10 }}
              env:
                {{- toYaml .Values.admission.env | nindent 10 }}
              securityContext:
                {{- toYaml .Values.admission.containerSecurityContext | nindent 10 }}
              volumeMounts:
                - name: tls-certs
                  mountPath: /etc/certs
                  readOnly: true
                - name: api-token
                  mountPath: /app/api-token
                  readOnly: true
                - name: module
                  mountPath: /app/load
                  readOnly: true
          volumes:
            - name: tls-certs
              secret:
                secretName: pepr-{{ .Values.uuid }}-tls
            - name: api-token
              secret:
                secretName: pepr-{{ .Values.uuid }}-api-token
            - name: module
              secret:
                secretName: pepr-{{ .Values.uuid }}-module  
  `
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
  const compressedData = compressed.toString("base64");
  if (secretOverLimit(compressedData)) {
    const error = new Error(`Module secret for ${name} is over the 1MB limit`);
    console.error("Uncaught Exception:", error);
    process.exit(1);
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
