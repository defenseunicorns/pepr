// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import {
  dumpYaml,
  V1Affinity,
  V1EnvVar,
  V1PodSpec,
  V1Probe,
  V1ResourceRequirements,
  V1Toleration,
  V1VolumeMount,
  V1Volume,
  V1PodSecurityContext,
} from "@kubernetes/client-node";
import Log from "../logger";
import crypto from "crypto";
import { promises as fs } from "fs";
import { Assets } from ".";
import { apiTokenSecret, service, tlsSecret, watcherService } from "./networking";
import { deployment, moduleSecret, namespace, watcher, genEnv } from "./pods";
import { clusterRole, clusterRoleBinding, serviceAccount, storeRole, storeRoleBinding } from "./rbac";
import { webhookConfig } from "./webhooks";

const DEFAULT_WEBHOOK_TIMEOUT_SECS = 30;
const DEFAULT_USER_ID = 65532;

enum FailurePolicy {
  Fail = "Fail",
  Ignore = "Ignore",
  Reject = "reject",
}

interface Config<T = Record<string, unknown>> {
  onError?: string;
  webhookTimeout: number;
  description?: string;
  uuid: string;
  alwaysIgnore: {
    namespaces: string[];
  };
  additionalFields?: T; // Add other properties as needed
}

interface BaseConfig {
  terminationGracePeriodSeconds: number;
  env: V1EnvVar[];
  image: string;
  annotations: Record<string, string>;
  labels: Record<string, string>;
  securityContext: V1PodSpec["securityContext"];
  readinessProbe: V1Probe;
  livenessProbe: V1Probe;
  resources: V1ResourceRequirements;
  containerSecurityContext: V1PodSpec["containers"][0]["securityContext"];
  nodeSelector: Record<string, string>;
  tolerations: V1Toleration[];
  extraVolumeMounts: V1VolumeMount[];
  extraVolumes: V1Volume[];
  affinity: V1Affinity;
  podAnnotations: Record<string, string>;
  serviceMonitor: {
    enabled: boolean;
    labels: Record<string, string>;
    annotations: Record<string, string>;
  };
}
interface GeneratedConfig extends BaseConfig {
  failurePolicy?: string;
  webhookTimeout: number;
}
interface ZarfPackageConfig {
  kind: string;
  metadata: {
    name: string;
    description: string;
    url: string;
    version: string;
  };
  components: Array<{
    name: string;
    required: boolean;
    manifests?: Array<{ name: string; namespace: string; files: string[] }>;
    charts?: Array<{ name: string; namespace: string; version: string; localPath: string }>;
    images: string[];
  }>;
}

interface ContainerSecurityContext {
  runAsUser: number;
  runAsGroup: number;
  runAsNonRoot: boolean;
  allowPrivilegeEscalation: boolean;
  capabilities: { drop: string[] };
}

interface Overrides {
  secrets: { apiToken: string };
  hash: string;
  namespace: {
    annotations: Record<string, string>;
    labels: Record<string, string>;
  };
  uuid: string;
  admission: GeneratedConfig;
  watcher: BaseConfig;
}

export function generateOverrides(assets: Assets, apiToken: string): Overrides {
  const { hash, name, config, image } = assets;

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
        webhookTimeout: config.webhookTimeout ?? DEFAULT_WEBHOOK_TIMEOUT_SECS,
        alwaysIgnore: { namespaces: config.alwaysIgnore?.namespaces ?? [] },
      },
      image,
      name,
    ),
    watcher: generateWatcherConfig(
      {
        ...config,
        webhookTimeout: config.webhookTimeout ?? DEFAULT_WEBHOOK_TIMEOUT_SECS,
        alwaysIgnore: { namespaces: config.alwaysIgnore?.namespaces ?? [] }, // Ensure alwaysIgnore.namespaces is always an array
      },
      image,
      name,
    ),
  };
}

export function generateAdmissionConfig(config: Config, image: string, name: string): GeneratedConfig {
  if (!config.uuid) {
    Log.error(`UUID is required in config for image ${image} and name ${name}`);
    throw new Error(`uuid is required in config for image ${image} and name ${name}`);
  }

  return {
    terminationGracePeriodSeconds: 5,
    failurePolicy: config.onError === FailurePolicy.Reject ? FailurePolicy.Fail : FailurePolicy.Ignore,
    webhookTimeout: config.webhookTimeout ?? DEFAULT_WEBHOOK_TIMEOUT_SECS,
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

export function generateWatcherConfig(config: Config, image: string, name: string): BaseConfig {
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

export function generateSecurityContext(): V1PodSecurityContext {
  return {
    runAsUser: DEFAULT_USER_ID,
    runAsGroup: DEFAULT_USER_ID,
    runAsNonRoot: true,
    fsGroup: DEFAULT_USER_ID,
  };
}

export function generateContainerSecurityContext(): ContainerSecurityContext {
  return {
    runAsUser: DEFAULT_USER_ID,
    runAsGroup: DEFAULT_USER_ID,
    runAsNonRoot: true,
    allowPrivilegeEscalation: false,
    capabilities: {
      drop: ["ALL"],
    },
  };
}

export function generateProbeConfig(): V1Probe {
  return {
    httpGet: { path: "/healthz", port: 3000, scheme: "HTTPS" },
    initialDelaySeconds: 10,
  };
}

export function generateResourceConfig(): V1ResourceRequirements {
  return {
    requests: { memory: "64Mi", cpu: "100m" },
    limits: { memory: "256Mi", cpu: "500m" },
  };
}

export async function writeOverridesFile(assets: Assets, path: string): Promise<void> {
  const { apiToken } = assets;

  if (!apiToken) {
    throw new Error("apiToken is required");
  }

  const overrides = generateOverrides(assets, apiToken);
  await fs.writeFile(path, dumpYaml(overrides, { noRefs: true, forceQuotes: true }));
}

export function generateZarfConfig(assets: Assets, path: string, chart = false): ZarfPackageConfig {
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

export function writeZarfYaml(assets: Assets, path: string): string {
  return dumpYaml(generateZarfConfig(assets, path), { noRefs: true });
}

export function writeZarfYamlChart(assets: Assets, path: string): string {
  return dumpYaml(generateZarfConfig(assets, path, true), { noRefs: true });
}

export async function generateAllYaml(assets: Assets, rbacMode: string, imagePullSecret?: string): Promise<string> {
  const { name, tls, apiToken, path, capabilities } = assets;
  const code = await fs.readFile(path);

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
