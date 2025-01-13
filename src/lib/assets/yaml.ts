// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { dumpYaml, V1Deployment } from "@kubernetes/client-node";
import { promises as fs } from "fs";
import { apiTokenSecret, service, tlsSecret, watcherService } from "./networking";
import { getModuleSecret, getNamespace } from "./pods";
import { clusterRole, clusterRoleBinding, serviceAccount, storeRole, storeRoleBinding } from "./rbac";
import { genEnv } from "./pods";
import { ModuleConfig } from "../core/module";
import { CapabilityExport } from "../types";
import { webhookConfig } from "./webhooks";
import { Assets } from "./assets";

type CommonOverrideValues = {
  apiToken: string;
  capabilities: CapabilityExport[];
  config: ModuleConfig;
  hash: string;
  name: string;
};

type ChartOverrides = CommonOverrideValues & {
  image: string;
};

// Helm Chart overrides file (values.yaml) generated from assets
export async function overridesFile(
  { hash, name, image, config, apiToken, capabilities }: ChartOverrides,
  path: string,
): Promise<void> {
  const rbacOverrides = clusterRole(name, capabilities, config.rbacMode, config.rbac).rules;

  const overrides = {
    rbac: rbacOverrides,
    secrets: {
      apiToken: Buffer.from(apiToken).toString("base64"),
    },
    hash,
    namespace: {
      annotations: {},
      labels: {
        "pepr.dev": "",
      },
    },
    uuid: name,
    admission: {
      terminationGracePeriodSeconds: 5,
      failurePolicy: config.onError === "reject" ? "Fail" : "Ignore",
      webhookTimeout: config.webhookTimeout,
      env: genEnv(config, false, true),
      envFrom: [],
      image,
      annotations: {
        "pepr.dev/description": `${config.description}` || "",
      },
      labels: {
        app: name,
        "pepr.dev/controller": "admission",
        "pepr.dev/uuid": config.uuid,
      },
      securityContext: {
        runAsUser: 65532,
        runAsGroup: 65532,
        runAsNonRoot: true,
        fsGroup: 65532,
      },
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
      containerSecurityContext: {
        runAsUser: 65532,
        runAsGroup: 65532,
        runAsNonRoot: true,
        allowPrivilegeEscalation: false,
        capabilities: {
          drop: ["ALL"],
        },
      },
      podAnnotations: {},
      nodeSelector: {},
      tolerations: [],
      extraVolumeMounts: [],
      extraVolumes: [],
      affinity: {},
      serviceMonitor: {
        enabled: false,
        labels: {},
        annotations: {},
      },
    },
    watcher: {
      terminationGracePeriodSeconds: 5,
      env: genEnv(config, true, true),
      envFrom: [],
      image,
      annotations: {
        "pepr.dev/description": `${config.description}` || "",
      },
      labels: {
        app: `${name}-watcher`,
        "pepr.dev/controller": "watcher",
        "pepr.dev/uuid": config.uuid,
      },
      securityContext: {
        runAsUser: 65532,
        runAsGroup: 65532,
        runAsNonRoot: true,
        fsGroup: 65532,
      },
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
      containerSecurityContext: {
        runAsUser: 65532,
        runAsGroup: 65532,
        runAsNonRoot: true,
        allowPrivilegeEscalation: false,
        capabilities: {
          drop: ["ALL"],
        },
      },
      nodeSelector: {},
      tolerations: [],
      extraVolumeMounts: [],
      extraVolumes: [],
      affinity: {},
      podAnnotations: {},
      serviceMonitor: {
        enabled: false,
        labels: {},
        annotations: {},
      },
    },
  };

  await fs.writeFile(path, dumpYaml(overrides, { noRefs: true, forceQuotes: true }));
}

type deployments = { default: V1Deployment; watch: V1Deployment | null };

export async function generateAllYaml(assets: Assets, deployments: deployments): Promise<string> {
  const { name, tls, hash, apiToken, path, config } = assets;
  const code = await fs.readFile(path);

  const resources = [
    getNamespace(assets.config.customLabels?.namespace),
    clusterRole(name, assets.capabilities, config.rbacMode, config.rbac),
    clusterRoleBinding(name),
    serviceAccount(name),
    apiTokenSecret(name, apiToken),
    tlsSecret(name, tls),
    deployments.default,
    service(name),
    watcherService(name),
    getModuleSecret(name, code, hash),
    storeRole(name),
    storeRoleBinding(name),
  ];

  const webhooks = {
    mutate: await webhookConfig(assets, "mutate", assets.config.webhookTimeout),
    validate: await webhookConfig(assets, "validate", assets.config.webhookTimeout),
  };

  if (webhooks.mutate) {
    resources.push(webhooks.mutate);
  }

  if (webhooks.validate) {
    resources.push(webhooks.validate);
  }

  if (deployments.watch) {
    resources.push(deployments.watch);
  }

  // Convert the resources to a single YAML string
  return resources.map(r => dumpYaml(r, { noRefs: true })).join("---\n");
}
