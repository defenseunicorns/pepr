// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { dumpYaml } from "@kubernetes/client-node";
import crypto from "crypto";
import { promises as fs } from "fs";

import { Assets } from ".";
import { apiTokenSecret, service, tlsSecret, watcherService } from "./networking";
import { deployment, moduleSecret, namespace, watcher } from "./pods";
import { clusterRole, clusterRoleBinding, serviceAccount, storeRole, storeRoleBinding } from "./rbac";
import { webhookConfig } from "./webhooks";

// Overrides file generated from assets
export function overridesFile(assets: Assets, hash: string) {
  const { name, image, config } = assets;

  const overrides = {
    hash,
    uuid: name,
    image: {
      repository: "",
      tag: "",
      pullPolicy: "IfNotPresent"
    },
    admission: {
      env: [
        { name: "PEPR_WATCH_MODE", value: "false" },
        {name: "PEPR_PRETTY_LOG", value: "false"},
        { name: "LOG_LEVEL", value: "debug"}
      ],
      image,
      annotations: {
        "pepr.dev/description": config.description || ""
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
      nodeSelector: {},
      tolerations: [],
      affinity: {}
    },
    watcher: {
      env: [
        { name: "PEPR_WATCH_MODE", value: "true" },
        {name: "PEPR_PRETTY_LOG", value: "false"},
        { name: "LOG_LEVEL", value: "debug"}
      ],
      image,
      annotations: {
        "pepr.dev/description": config.description || ""
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
      nodeSelector: {},
      tolerations: [],
      affinity: {}
    },
    service: {
      type: "ClusterIP",
    }
  }
  return overrides
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

  return dumpYaml(zarfCfg, { noRefs: true });
}

export async function allYaml(assets: Assets, rbacMode: string) {
  const { name, tls, apiToken, path } = assets;

  const code = await fs.readFile(path);

  // Generate a hash of the code
  const hash = crypto.createHash("sha256").update(code).digest("hex");

  const mutateWebhook = await webhookConfig(assets, "mutate", assets.config.webhookTimeout);
  const validateWebhook = await webhookConfig(assets, "validate", assets.config.webhookTimeout);
  const watchDeployment = watcher(assets, hash);

  const resources = [
    namespace(assets.config.customLabels?.namespace),
    clusterRole(name, assets.capabilities, rbacMode),
    clusterRoleBinding(name),
    serviceAccount(name),
    apiTokenSecret(name, apiToken),
    tlsSecret(name, tls),
    deployment(assets, hash),
    service(name),
    watcherService(name),
    moduleSecret(name, code, hash),
    storeRole(name),
    storeRoleBinding(name),
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
