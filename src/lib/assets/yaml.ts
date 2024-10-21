/* eslint-disable complexity */
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { dumpYaml } from "@kubernetes/client-node";
import crypto from "crypto";
import { promises as fs } from "fs";
import { Assets } from ".";
import { apiTokenSecret, service, tlsSecret, watcherService } from "./networking";
import { deployment, moduleSecret, namespace, watcher } from "./pods";
import { getClusterRole, getClusterRoleBinding, getServiceAccount, getStoreRole, getStoreRoleBinding } from "./rbac";
import { webhookConfig } from "./webhooks";
import { genEnv } from "./pods";
import path from "path";

/**
 * Function to generate Helm Chart overrides file (values.yaml) from assets
 * @param {Assets} assets - The assets object containing the module's configuration and data.
 * @param {string} filePath - The path where the values.yaml file will be written.
 */
export async function overridesFile(assets: Assets, filePath: string, rbacMode: string) {
  try {
    // Set the RBAC mode from the assets configuration, or default if not provided
    console.log(`Generating overrides file with RBAC mode: ${rbacMode}`);

    // Generate ClusterRole and StoreRole using the provided capabilities
    const clusterRole = getClusterRole(assets.name, assets.capabilities, rbacMode);
    const storeRole = getStoreRole(assets.name);

    // Check if generated roles have rules
    const clusterRoleRules = clusterRole.rules && clusterRole.rules.length > 0 ? clusterRole.rules : [];
    const storeRoleRules = storeRole.rules && storeRole.rules.length > 0 ? storeRole.rules : [];

    const overrides = {
      secrets: {
        apiToken: Buffer.from(assets.apiToken).toString("base64"),
      },
      hash: assets.hash,
      namespace: {
        annotations: {},
        labels: {
          "pepr.dev": "",
        },
      },
      uuid: assets.name,
      admission: {
        terminationGracePeriodSeconds: 5,
        failurePolicy: assets.config.onError === "reject" ? "Fail" : "Ignore",
        webhookTimeout: assets.config.webhookTimeout,
        env: genEnv(assets.config, false, true), // Generate environment variables
        envFrom: [],
        image: assets.image,
        annotations: {
          "pepr.dev/description": `${assets.config.description}` || "",
        },
        labels: {
          app: assets.name,
          "pepr.dev/controller": "admission",
          "pepr.dev/uuid": assets.config.uuid,
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
        env: genEnv(assets.config, true, true),
        envFrom: [],
        image: assets.image,
        annotations: {
          "pepr.dev/description": `${assets.config.description}` || "",
        },
        labels: {
          app: `${assets.name}-watcher`,
          "pepr.dev/controller": "watcher",
          "pepr.dev/uuid": assets.config.uuid,
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

      // Custom RBAC section to add ClusterRole and Role
      rbac: {
        clusterRoles: clusterRoleRules.length ? [{ rules: clusterRoleRules }] : [],
        roles: storeRoleRules.length ? [{ rules: storeRoleRules }] : [],
      },
    };

    // Check if the output directory exists and create it if needed
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Write the overrides YAML to the specified file path
    await fs.writeFile(filePath, dumpYaml(overrides, { noRefs: true, forceQuotes: true }));
    console.log(`Successfully wrote overrides to ${filePath}`);
  } catch (err) {
    console.error(`Failed to write overrides file at ${filePath}:`, err);
    throw new Error(`Error generating overrides file: ${err.message}`);
  }
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
