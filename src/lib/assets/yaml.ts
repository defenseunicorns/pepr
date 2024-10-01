// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { dumpYaml } from "@kubernetes/client-node";
import crypto from "crypto";
import { promises as fs } from "fs";
import { Assets } from ".";
import { apiTokenSecret, service, tlsSecret, watcherService } from "./networking";
import { deployment, moduleSecret, namespace, watcher, genEnv } from "./pods";
import { clusterRole, clusterRoleBinding, serviceAccount, storeRole, storeRoleBinding } from "./rbac";
import { webhookConfig } from "./webhooks";

// Generates the overrides object
export function generateOverrides(assets: Assets, image: string, apiToken: string) {
  const { hash, name, config } = assets;

  return {
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
    admission: generateAdmissionConfig(
      {
        ...config,
        webhookTimeout: config.webhookTimeout ?? 30,
        alwaysIgnore: { namespaces: config.alwaysIgnore?.namespaces ?? [] },
      },
      image,
      name,
    ),
    watcher: generateWatcherConfig(
      {
        ...config,
        webhookTimeout: config.webhookTimeout ?? 30, // Provide a default value if undefined
        alwaysIgnore: { namespaces: config.alwaysIgnore?.namespaces ?? [] }, // Ensure alwaysIgnore.namespaces is always an array
      },
      image,
      name,
    ),
  };
}

// Generates the admission object configuration
interface Config {
  onError?: string;
  webhookTimeout: number;
  description?: string;
  uuid: string;
  alwaysIgnore: {
    namespaces: string[];
  };
  [key: string]: unknown; // Add other properties as needed
}

export function generateAdmissionConfig(config: Config, image: string, name: string) {
  if (!config.uuid) {
    throw new Error("uuid is required in config");
  }

  return {
    terminationGracePeriodSeconds: 5,
    failurePolicy: config.onError === "reject" ? "Fail" : "Ignore",
    webhookTimeout: config.webhookTimeout ?? 30,
    env: genEnv(config, false, true),
    image,
    annotations: { "pepr.dev/description": config.description || "" },
    labels: {
      app: name,
      "pepr.dev/controller": "admission",
      "pepr.dev/uuid": config.uuid,
    },
    securityContext: generateSecurityContext(),
    readinessProbe: generateProbeConfig(),
    livenessProbe: generateProbeConfig(),
    resources: generateResourceConfig(),
    containerSecurityContext: generateContainerSecurityContext(),
    nodeSelector: {},
    tolerations: [],
    extraVolumeMounts: [],
    extraVolumes: [],
    affinity: {},
    podAnnotations: {},
    serviceMonitor: { enabled: false, labels: {}, annotations: {} },
  };
}

// Generates the watcher object configuration
export function generateWatcherConfig(config: Config, image: string, name: string) {
  return {
    terminationGracePeriodSeconds: 5,
    env: genEnv(config, true, true),
    image,
    annotations: { "pepr.dev/description": `${config.description}` || "" },
    labels: {
      app: `${name}-watcher`,
      "pepr.dev/controller": "watcher",
      "pepr.dev/uuid": config.uuid,
    },
    securityContext: generateSecurityContext(),
    readinessProbe: generateProbeConfig(),
    livenessProbe: generateProbeConfig(),
    resources: generateResourceConfig(),
    containerSecurityContext: generateContainerSecurityContext(),
    nodeSelector: {},
    tolerations: [],
    extraVolumeMounts: [],
    extraVolumes: [],
    affinity: {},
    podAnnotations: {},
    serviceMonitor: { enabled: false, labels: {}, annotations: {} },
  };
}

// Generates the security context configuration
export function generateSecurityContext() {
  return {
    runAsUser: 65532,
    runAsGroup: 65532,
    runAsNonRoot: true,
    fsGroup: 65532,
  };
}

// Generates the container security context
export function generateContainerSecurityContext() {
  return {
    runAsUser: 65532,
    runAsGroup: 65532,
    runAsNonRoot: true,
    allowPrivilegeEscalation: false,
    capabilities: {
      drop: ["ALL"],
    },
  };
}

// Generates the probe configuration
export function generateProbeConfig() {
  return {
    httpGet: { path: "/healthz", port: 3000, scheme: "HTTPS" },
    initialDelaySeconds: 10,
  };
}

// Generates the resource configuration
export function generateResourceConfig() {
  return {
    requests: { memory: "64Mi", cpu: "100m" },
    limits: { memory: "256Mi", cpu: "500m" },
  };
}

// Writes the overrides file
export async function overridesFile(assets: Assets, path: string) {
  const { apiToken } = assets;

  if (!apiToken) {
    throw new Error("apiToken is required");
  }

  const overrides = generateOverrides(assets, assets.image, apiToken);
  await fs.writeFile(path, dumpYaml(overrides, { noRefs: true, forceQuotes: true }));
}

// Generates Zarf YAML
export function generateZarfConfig(assets: Assets, path: string, chart = false) {
  const { name, image, config } = assets;

  return {
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
        manifests: !chart ? [{ name: "module", namespace: "pepr-system", files: [path] }] : undefined,
        charts: chart
          ? [{ name: "module", namespace: "pepr-system", version: `${config.appVersion || "0.0.1"}`, localPath: path }]
          : undefined,
        images: [image],
      },
    ],
  };
}

// Writes Zarf YAML for a manifest file
export function zarfYaml(assets: Assets, path: string) {
  return dumpYaml(generateZarfConfig(assets, path), { noRefs: true });
}

// Writes Zarf YAML for a Helm chart
export function zarfYamlChart(assets: Assets, path: string) {
  return dumpYaml(generateZarfConfig(assets, path, true), { noRefs: true });
}

// Generates and writes all resources into a YAML string
export async function allYaml(assets: Assets, rbacMode: string, imagePullSecret?: string) {
  const { name, tls, apiToken, path, capabilities = [] } = assets; // Ensure default empty array for capabilities
  const code = await fs.readFile(path);

  // Generate a hash of the code
  assets.hash = crypto.createHash("sha256").update(code).digest("hex");

  const mutateWebhook = await webhookConfig(assets, "mutate", assets.config.webhookTimeout);
  const validateWebhook = await webhookConfig(assets, "validate", assets.config.webhookTimeout);
  const watchDeployment = watcher(assets, assets.hash, assets.buildTimestamp, imagePullSecret);

  const resources = [
    namespace(assets.config.customLabels?.namespace),
    clusterRole(name, capabilities, rbacMode),
    clusterRoleBinding(name),
    serviceAccount(name),
    apiTokenSecret(name, apiToken),
    tlsSecret(name, tls),
    deployment(assets, assets.hash, assets.buildTimestamp, imagePullSecret),
    service(name),
    watcherService(name),
    moduleSecret(name, code, assets.hash),
    storeRole(name),
    storeRoleBinding(name),
  ];

  if (mutateWebhook) resources.push(mutateWebhook);
  if (validateWebhook) resources.push(validateWebhook);
  if (watchDeployment) resources.push(watchDeployment);

  return resources.map(r => dumpYaml(r, { noRefs: true })).join("\n---\n");
}
