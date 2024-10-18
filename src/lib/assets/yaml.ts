// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { dumpYaml } from "@kubernetes/client-node";
import crypto from "crypto";
import { promises as fs } from "fs";
import { Assets } from ".";
import { apiTokenSecret, service, tlsSecret, watcherService } from "./networking";
import { deployment, moduleSecret, namespace, watcher } from "./pods";
import {
  getClusterRole,
  getClusterRoleBinding,
  getServiceAccount,
  getStoreRole,
  getStoreRoleBinding,
  getCustomClusterRoleRule,
  getCustomStoreRoleRule,
} from "./rbac";
import { webhookConfig } from "./webhooks";
import { genEnv } from "./pods";

/**
 * Function to generate Helm Chart overrides file (values.yaml) from assets
 * @param {Assets} assets - The assets object containing the module's configuration and data.
 * @param {string} path - The path where the values.yaml file will be written.
 */
export async function overridesFile({ hash, name, image, config, apiToken }: Assets, path: string) {
  // Fetch custom rules from the package.json file (or other source)
  const customClusterRoleRules = getCustomClusterRoleRule(); // Extract custom ClusterRole rules
  const customStoreRoleRules = getCustomStoreRoleRule(); // Extract custom Role rules

  const overrides = {
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
      env: genEnv(config, false, true), // Generate environment variables
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

    // Custom RBAC section to add ClusterRoles and Roles
    rbac: {
      clusterRoles: customClusterRoleRules.map((rule, index) => ({
        name: `custom-cluster-role-${index + 1}`,
        rules: rule,
      })),
      roles: customStoreRoleRules.map((rule, index) => ({
        name: `custom-role-${index + 1}`,
        rules: rule,
      })),
    },
  };

  // Write the updated overrides to the values.yaml file
  await fs.writeFile(path, dumpYaml(overrides, { noRefs: true, forceQuotes: true }));
}

export function zarfYaml({ name, image, config }: Assets, path: string) {
  const zarfCfg = {
    kind: "ZarfPackageConfig",
    metadata: {
      name,
      description: `Pepr Module: ${config.description}`,
      url: "https://github.com/defenseunicorns/pepr",
      version: `${config.appVersion || "0.0.1"}`,
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
        images: [image],
      },
    ],
  };

  return dumpYaml(zarfCfg);
}

export function zarfYamlChart({ name, image, config }: Assets, path: string) {
  const zarfCfg = {
    kind: "ZarfPackageConfig",
    metadata: {
      name,
      description: `Pepr Module: ${config.description}`,
      url: "https://github.com/defenseunicorns/pepr",
      version: `${config.appVersion || "0.0.1"}`,
    },
    components: [
      {
        name: "module",
        required: true,
        charts: [
          {
            name: "module",
            namespace: "pepr-system",
            version: `${config.appVersion || "0.0.1"}`,
            localPath: path,
          },
        ],
        images: [image],
      },
    ],
  };

  return dumpYaml(zarfCfg);
}

export async function allYaml(assets: Assets, rbacMode: string, imagePullSecret?: string) {
  const { name, tls, apiToken, path } = assets;
  const code = await fs.readFile(path);

  // Generate a hash of the code
  assets.hash = crypto.createHash("sha256").update(code).digest("hex");

  const mutateWebhook = await webhookConfig(assets, "mutate", assets.config.webhookTimeout);
  const validateWebhook = await webhookConfig(assets, "validate", assets.config.webhookTimeout);
  const watchDeployment = watcher(assets, assets.hash, assets.buildTimestamp, imagePullSecret);

  const resources = [
    namespace(assets.config.customLabels?.namespace),
    getClusterRole(name, assets.capabilities, rbacMode), // Generated ClusterRole
    getClusterRoleBinding(name),
    getServiceAccount(name),
    apiTokenSecret(name, apiToken),
    tlsSecret(name, tls),
    deployment(assets, assets.hash, assets.buildTimestamp, imagePullSecret),
    service(name),
    watcherService(name),
    moduleSecret(name, code, assets.hash),
    getStoreRole(name),
    getStoreRoleBinding(name),
  ];

  if (mutateWebhook) {
    resources.push(mutateWebhook);
  }

  if (validateWebhook) {
    resources.push(validateWebhook);
  }

  if (watchDeployment) {
    resources.push(watchDeployment);
  }

  // Convert the resources to a single YAML string
  return resources.map(r => dumpYaml(r, { noRefs: true })).join("---\n");
}
