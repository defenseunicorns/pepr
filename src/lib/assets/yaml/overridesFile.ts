import { genEnv } from "../environment";
import { CapabilityExport, ModuleConfig } from "../../types";
import { dumpYaml } from "@kubernetes/client-node";
import { clusterRole } from "../rbac";
import { promises as fs } from "fs";
import { resolveIgnoreNamespaces } from "../ignoredNamespaces";
import { quicktype, InputData, jsonInputForTargetLanguage } from "quicktype-core";

export type ChartOverrides = {
  apiPath: string;
  capabilities: CapabilityExport[];
  config: ModuleConfig;
  hash: string;
  name: string;
  image: string;
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
    additionalIgnoredNamespaces: resolveIgnoreNamespaces(
      config?.alwaysIgnore?.namespaces?.length
        ? config?.alwaysIgnore?.namespaces
        : config?.admission?.alwaysIgnore?.namespaces,
    ),
    rbac: rbacOverrides,
    secrets: {
      apiPath: Buffer.from(apiPath).toString("base64"),
    },
    hash,
    namespace: {
      annotations: {},
      labels: config.customLabels?.namespace ?? {
        "pepr.dev": "",
      },
    },
    uuid: name,
    admission: {
      enabled: controllerType.admission === true ? true : false,
      antiAffinity: false,
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
        runAsUser: image.includes("private") ? 1000 : 65532,
        runAsGroup: image.includes("private") ? 1000 : 65532,
        runAsNonRoot: true,
        fsGroup: image.includes("private") ? 1000 : 65532,
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
        runAsUser: image.includes("private") ? 1000 : 65532,
        runAsGroup: image.includes("private") ? 1000 : 65532,
        runAsNonRoot: true,
        allowPrivilegeEscalation: false,
        capabilities: {
          drop: ["ALL"],
        },
      },
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
      enabled: controllerType.watcher === true ? true : false,
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
        runAsUser: image.includes("private") ? 1000 : 65532,
        runAsGroup: image.includes("private") ? 1000 : 65532,
        runAsNonRoot: true,
        fsGroup: image.includes("private") ? 1000 : 65532,
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
        runAsUser: image.includes("private") ? 1000 : 65532,
        runAsGroup: image.includes("private") ? 1000 : 65532,
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
      podLabels: {},
      serviceMonitor: {
        enabled: false,
        labels: {},
        annotations: {},
      },
    },
  };
  /** write values.schema.yaml */
  await writeSchemaYamlFromObject(JSON.stringify(overrides, null, 2), path);
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
