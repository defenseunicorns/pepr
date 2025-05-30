import { genEnv } from "../envrionment";
import { CapabilityExport, ModuleConfig } from "../../types";
import { dumpYaml } from "@kubernetes/client-node";
import { clusterRole } from "../rbac";
import { promises as fs } from "fs";
import { resolveIgnoreNamespaces } from "../ignoredNamespaces";
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
        runAsUser: image.includes("private") ? 1000 : 65532,
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
        runAsUser: image.includes("private") ? 1000 : 65532,
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
        runAsUser: image.includes("private") ? 1000 : 65532,
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
