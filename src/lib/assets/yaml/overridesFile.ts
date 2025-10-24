import { genEnv } from "../environment";
import { CapabilityExport, ModuleConfig } from "../../types";
import { dumpYaml } from "@kubernetes/client-node";
import { clusterRole } from "../rbac";
import { promises as fs } from "fs";
import { getIgnoreNamespaces } from "../ignoredNamespaces";
import { quicktype, InputData, jsonInputForTargetLanguage } from "quicktype-core";

export type ChartOverrides = {
  apiPath: string;
  capabilities: CapabilityExport[];
  config: ModuleConfig;
  hash: string;
  name: string;
  image: string;
};
type Probes = {
  readinessProbe: {
    httpGet: { path: string; port: number; scheme: "HTTPS" };
    initialDelaySeconds: number;
  };
  livenessProbe: {
    httpGet: { path: string; port: number; scheme: "HTTPS" };
    initialDelaySeconds: number;
  };
};
type Resources = {
  requests: { memory: string; cpu: string };
  limits: { memory: string; cpu: string };
};
type PodSecurityContext = {
  runAsUser: number;
  runAsGroup: number;
  runAsNonRoot: true;
  fsGroup: number;
};
type ContainerSecurityContext = {
  runAsUser: number;
  runAsGroup: number;
  runAsNonRoot: true;
  allowPrivilegeEscalation: false;
  capabilities: { drop: ["ALL"] };
};

// Helm Chart overrides file (values.yaml) generated from assets
export async function overridesFile(
  { hash, name, image, config, apiPath, capabilities }: ChartOverrides,
  path: string,
  imagePullSecrets: string[],
  controllerType: { admission: boolean; watcher: boolean } = { admission: true, watcher: true },
): Promise<void> {
  const rbacOverrides = clusterRole(name, capabilities, config.rbacMode, config.rbac).rules;

  const overrides = {
    imagePullSecrets,
    additionalIgnoredNamespaces: getIgnoreNamespaces(config),
    rbac: rbacOverrides,
    secrets: { apiPath: Buffer.from(apiPath).toString("base64") },
    hash,
    namespace: namespaceBlock(config),
    uuid: name,
    admission: {
      enabled: controllerType.admission === true,
      antiAffinity: false,
      terminationGracePeriodSeconds: 5,
      failurePolicy: config.onError === "reject" ? "Fail" : "Ignore",
      webhookTimeout: config.webhookTimeout,
      env: genEnv(config, false, true),
      envFrom: [],
      image,
      annotations: controllerAnnotations(config.description),
      labels: controllerLabels(name, config.uuid, "admission"),
      securityContext: podSecurityContext(image),
      ...commonProbes(),
      resources: commonResources(),
      containerSecurityContext: containerSecurityContext(image),
      podAnnotations: {},
      podLabels: {},
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
      enabled: controllerType.watcher === true,
      terminationGracePeriodSeconds: 5,
      env: genEnv(config, true, true),
      envFrom: [],
      image,
      annotations: controllerAnnotations(config.description),
      labels: controllerLabels(name, config.uuid, "watcher"),
      securityContext: podSecurityContext(image),
      ...commonProbes(),
      resources: commonResources(),
      containerSecurityContext: containerSecurityContext(image),
      nodeSelector: {},
      tolerations: [],
      extraVolumeMounts: [],
      extraVolumes: [],
      affinity: {},
      podAnnotations: {},
      podLabels: {},
      serviceMonitor: {
        enabled: false,
        labels: {},
        annotations: {},
      },
    },
  };

  await writeSchemaYamlFromObject(JSON.stringify(overrides, null, 2), path);
  // write values.yaml
  await fs.writeFile(path, dumpYaml(overrides, { noRefs: true, forceQuotes: true }));
}

export async function writeSchemaYamlFromObject(
  valuesString: string,
  valuesFilePath: string,
): Promise<void> {
  const schemaPath = valuesFilePath.replace(/\.yaml$/, ".schema.json");
  const jsonInput = jsonInputForTargetLanguage("schema");
  await jsonInput.addSource({ name: "Values", samples: [valuesString] });

  const inputData = new InputData();
  inputData.addInput(jsonInput);

  const { lines } = await quicktype({ inputData, lang: "schema" });

  const schemaJson = lines.join("\n");
  const schemaObj = JSON.parse(schemaJson);

  await fs.writeFile(schemaPath, JSON.stringify(schemaObj, null, 2), "utf8");
}

function runIdsForImage(image: string): { uid: number; gid: number; fsGroup: number } {
  const id = image.includes("private") ? 1000 : 65532;
  return { uid: id, gid: id, fsGroup: id };
}

function commonProbes(): Probes {
  return {
    readinessProbe: {
      httpGet: { path: "/healthz", port: 3000, scheme: "HTTPS" },
      initialDelaySeconds: 10,
    },
    livenessProbe: {
      httpGet: { path: "/healthz", port: 3000, scheme: "HTTPS" },
      initialDelaySeconds: 10,
    },
  };
}

function commonResources(): Resources {
  return {
    requests: { memory: "256Mi", cpu: "200m" },
    limits: { memory: "512Mi", cpu: "500m" },
  };
}

function podSecurityContext(image: string): PodSecurityContext {
  const ids = runIdsForImage(image);
  return {
    runAsUser: ids.uid,
    runAsGroup: ids.gid,
    runAsNonRoot: true,
    fsGroup: ids.fsGroup,
  };
}

function containerSecurityContext(image: string): ContainerSecurityContext {
  const ids = runIdsForImage(image);
  return {
    runAsUser: ids.uid,
    runAsGroup: ids.gid,
    runAsNonRoot: true,
    allowPrivilegeEscalation: false,
    capabilities: { drop: ["ALL"] },
  };
}

function controllerLabels(
  name: string,
  uuid: string,
  kind: "admission" | "watcher",
): Record<string, string> {
  return {
    app: kind === "admission" ? name : `${name}-watcher`,
    "pepr.dev/controller": kind,
    "pepr.dev/uuid": uuid,
  };
}

function controllerAnnotations(description?: string): Record<string, string> {
  return { "pepr.dev/description": `${description ?? ""}` };
}

function namespaceBlock(config: ModuleConfig): {
  annotations: Record<string, string>;
  labels: Record<string, string>;
} {
  return {
    annotations: {},
    labels: config.customLabels?.namespace ?? { "pepr.dev": "" },
  };
}
