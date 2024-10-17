// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { dumpYaml, KubernetesObject, V1ClusterRoleBinding, V1RoleBinding } from "@kubernetes/client-node";
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
import { ClusterRoleRule, RoleRule } from "./helm";

// Function to generate Helm Chart overrides file (values.yaml) from assets
// Helm Chart overrides file (values.yaml) generated from assets
export async function overridesFile({ hash, name, image, config, apiToken }: Assets, path: string) {
  // Fetch custom rules from the package.json file
  const customClusterRoleRules = getCustomClusterRoleRule(); // Extract ClusterRole rules
  const customStoreRoleRules = getCustomStoreRoleRule(); // Extract StoreRole rules

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
    customClusterRoleRules,
    customStoreRoleRules,
  };

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

// Type guard functions to check if an object matches the ClusterRoleRule or RoleRule types
function isClusterRoleRule(rule: unknown): rule is ClusterRoleRule {
  return (
    typeof rule === "object" &&
    rule !== null &&
    Array.isArray((rule as ClusterRoleRule).apiGroups) &&
    Array.isArray((rule as ClusterRoleRule).resources) &&
    Array.isArray((rule as ClusterRoleRule).verbs)
  );
}

function isRoleRule(rule: unknown): rule is RoleRule {
  return (
    typeof rule === "object" &&
    rule !== null &&
    Array.isArray((rule as RoleRule).apiGroups) &&
    Array.isArray((rule as RoleRule).resources) &&
    Array.isArray((rule as RoleRule).verbs)
  );
}

export async function allYaml(assets: Assets, rbacMode: string, imagePullSecret?: string) {
  const { name, tls, apiToken, path } = assets;
  const code = await fs.readFile(path);

  // Generate a hash of the code
  assets.hash = crypto.createHash("sha256").update(code).digest("hex");

  const mutateWebhook = await webhookConfig(assets, "mutate", assets.config.webhookTimeout);
  const validateWebhook = await webhookConfig(assets, "validate", assets.config.webhookTimeout);
  const watchDeployment = watcher(assets, assets.hash, assets.buildTimestamp, imagePullSecret);

  // Fetch custom rules from the RBAC configuration
  const rawCustomClusterRoleRules = getCustomClusterRoleRule();
  const rawCustomStoreRoleRules = getCustomStoreRoleRule();

  // Validate and transform the raw cluster role rules to ensure they match the expected structure
  const customClusterRoleRules: ClusterRoleRule[] = rawCustomClusterRoleRules.filter(isClusterRoleRule).map(rule => ({
    apiGroups: rule.apiGroups,
    resources: rule.resources,
    verbs: rule.verbs,
  }));

  // Validate and transform the raw store role rules to ensure they match the expected structure
  const customStoreRoleRules: RoleRule[] = rawCustomStoreRoleRules.filter(isRoleRule).map(rule => ({
    apiGroups: rule.apiGroups,
    resources: rule.resources,
    verbs: rule.verbs,
  }));

  // Generate the custom RBAC resources using the validated data as KubernetesObject instances
  const customClusterRole: KubernetesObject & { rules: ClusterRoleRule[] } = {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "ClusterRole",
    metadata: {
      name: "pepr-custom-cluster-role",
    },
    rules: customClusterRoleRules,
  };

  const customRole: KubernetesObject & { rules: RoleRule[] } = {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "Role",
    metadata: {
      name: "pepr-custom-role",
      namespace: "pepr-system",
    },
    rules: customStoreRoleRules as RoleRule[],
  };

  const customClusterRoleBinding: V1ClusterRoleBinding = {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "ClusterRoleBinding",
    metadata: {
      name: "pepr-custom-cluster-role-binding",
    },
    roleRef: {
      apiGroup: "rbac.authorization.k8s.io",
      kind: "ClusterRole",
      name: "pepr-custom-cluster-role",
    },
    subjects: [
      {
        kind: "ServiceAccount",
        name: "pepr-custom-service-account",
        namespace: "pepr-system",
      },
    ],
  };

  const customRoleBinding: V1RoleBinding = {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "RoleBinding",
    metadata: {
      name: "pepr-custom-role-binding",
      namespace: "pepr-system",
    },
    roleRef: {
      apiGroup: "rbac.authorization.k8s.io",
      kind: "Role",
      name: "pepr-custom-role",
    },
    subjects: [
      {
        kind: "ServiceAccount",
        name: "pepr-custom-service-account",
        namespace: "pepr-system",
      },
    ],
  };

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

    // Add the custom RBAC resources as objects
    customClusterRole,
    customRole,
    customClusterRoleBinding,
    customRoleBinding,
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
