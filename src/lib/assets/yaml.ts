// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { dumpYaml } from "@kubernetes/client-node";
import crypto from "crypto";
import { promises as fs } from "fs";
import { Assets } from ".";
import { apiTokenSecret, service, tlsSecret, watcherService } from "./networking";
import { deployment, moduleSecret, namespace, watcher, genEnv } from "./pods";
import {
  getAllClusterRoles,
  getAllClusterRoleBindings,
  getAllServiceAccounts,
  getAllRoles,
  getAllRoleBindings,
} from "./rbac";
import { webhookConfig } from "./webhooks";

// Function to generate Helm Chart overrides file (values.yaml) from assets
export async function overridesFile({ hash, name, image, config, apiToken }: Assets, path: string) {
  // Fetch custom RBAC configurations
  const customClusterRoles = getAllClusterRoles(name, [], "rbac"); // Use an empty capabilities array for Helm chart
  const customClusterRoleBindings = getAllClusterRoleBindings(name);
  const customServiceAccounts = getAllServiceAccounts(name);
  const customRoles = getAllRoles(name);
  const customRoleBindings = getAllRoleBindings(name);

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
      env: genEnv(config, false, true),
      image,
      annotations: {
        "pepr.dev/description": `${config.description || ""}`,
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
          memory: "64Mi",
          cpu: "100m",
        },
        limits: {
          memory: "256Mi",
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
    rbac: {
      clusterRoles: customClusterRoles,
      clusterRoleBindings: customClusterRoleBindings,
      serviceAccounts: customServiceAccounts,
      roles: customRoles,
      roleBindings: customRoleBindings,
    },
  };

  await fs.writeFile(path, dumpYaml(overrides));
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

  // Collect all resources that need to be added to the YAML file
  const resources = [
    namespace(assets.config.customLabels?.namespace),
    apiTokenSecret(name, apiToken),
    tlsSecret(name, tls),
    deployment(assets, assets.hash, assets.buildTimestamp, imagePullSecret),
    service(name),
    watcherService(name),
    moduleSecret(name, code, assets.hash),
  ];

  // Add RBAC items individually to ensure each has a separate YAML entry
  resources.push(
    ...getAllClusterRoles(name, assets.capabilities, rbacMode),
    ...getAllClusterRoleBindings(name),
    ...getAllServiceAccounts(name),
    ...getAllRoles(name),
    ...getAllRoleBindings(name),
  );

  // Add webhooks and watcher deployment if they exist
  if (mutateWebhook) {
    resources.push(mutateWebhook);
  }

  if (validateWebhook) {
    resources.push(validateWebhook);
  }

  if (watchDeployment) {
    resources.push(watchDeployment);
  }

  // Convert the resources to a single YAML string with separate entries
  return resources.map(resource => dumpYaml(resource)).join("\n---\n");
}
