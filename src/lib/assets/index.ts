// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import crypto from "crypto";
import { dumpYaml } from "@kubernetes/client-node";
import { kind } from "kubernetes-fluent-client";
import { ModuleConfig } from "../core/module";
import { TLSOut, genTLS } from "../tls";
import { CapabilityExport } from "../types";
import { WebhookIgnore } from "../k8s";
import { deploy } from "./deploy";
import { loadCapabilities } from "./loader";
import { allYaml, zarfYaml, overridesFile, zarfYamlChart } from "./yaml";
import { namespaceComplianceValidator, replaceString } from "../helpers";
import { dedent } from "../helpers";
import { resolve } from "path";
import {
  chartYaml,
  namespaceTemplate,
  admissionDeployTemplate,
  watcherDeployTemplate,
  clusterRoleTemplate,
  serviceMonitorTemplate,
} from "./helm";
import { promises as fs } from "fs";
import { webhookConfig } from "./webhooks";
import { apiTokenSecret, service, tlsSecret, watcherService } from "./networking";
import { getWatcher, getModuleSecret } from "./pods";

import { clusterRoleBinding, serviceAccount, storeRole, storeRoleBinding } from "./rbac";
import { createDirectoryIfNotExists } from "../filesystemService";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toYaml(obj: any): string {
  return dumpYaml(obj, { noRefs: true });
}

// Create a unit test for this function
export function removeIgnoredNamespacesFromWebhook(
  webhookConfiguration: kind.MutatingWebhookConfiguration | kind.ValidatingWebhookConfiguration,
): kind.MutatingWebhookConfiguration | kind.ValidatingWebhookConfiguration {
  if (
    webhookConfiguration.webhooks &&
    webhookConfiguration.webhooks[0] &&
    webhookConfiguration.webhooks[0].namespaceSelector &&
    webhookConfiguration.webhooks[0].namespaceSelector.matchExpressions &&
    webhookConfiguration.webhooks[0].namespaceSelector.matchExpressions[1]
  ) {
    webhookConfiguration.webhooks[0].namespaceSelector.matchExpressions[1].values = [];
  }
  if (
    webhookConfiguration.webhooks &&
    webhookConfiguration.webhooks[0] &&
    webhookConfiguration.webhooks[0].objectSelector &&
    webhookConfiguration.webhooks[0].objectSelector.matchExpressions &&
    webhookConfiguration.webhooks[0].objectSelector.matchExpressions[1]
  ) {
    webhookConfiguration.webhooks[0].objectSelector.matchExpressions[1].values = [];
  }
  return webhookConfiguration;
}

// Create a unit test for this function
export function createWebhookYaml(
  assets: Assets,
  webhookConfiguration: kind.MutatingWebhookConfiguration | kind.ValidatingWebhookConfiguration,
): string {
  const yaml = toYaml(webhookConfiguration);
  const replacements = [
    { search: assets.name, replace: "{{ .Values.uuid }}" },
    {
      search: assets.config.onError === "reject" ? "Fail" : "Ignore",
      replace: "{{ .Values.admission.failurePolicy }}",
    },
    {
      search: `${assets.config.webhookTimeout}` || "10",
      replace: "{{ .Values.admission.webhookTimeout }}",
    },
    {
      search: `
        - key: kubernetes.io/metadata.name
          operator: NotIn
          values:
            - kube-system
            - pepr-system
`,
      replace: `
        - key: kubernetes.io/metadata.name
          operator: NotIn
          values:
            - kube-system
            - pepr-system
            {{- range .Values.additionalIgnoredNamespaces }}
            - {{ . }}
            {{- end }}
`,
    },
  ];

  return replacements.reduce((updatedYaml, { search, replace }) => replaceString(updatedYaml, search, replace), yaml);
}

function helmLayout(basePath: string, unique: string): Record<string, Record<string, string>> {
  const helm: Record<string, Record<string, string>> = {
    dirs: {
      chart: resolve(`${basePath}/${unique}-chart`),
    },
    files: {},
  };

  helm.dirs = {
    ...helm.dirs,
    charts: `${helm.dirs.chart}/charts`,
    tmpls: `${helm.dirs.chart}/templates`,
  };

  helm.files = {
    ...helm.files,
    valuesYaml: `${helm.dirs.chart}/values.yaml`,
    chartYaml: `${helm.dirs.chart}/Chart.yaml`,
    namespaceYaml: `${helm.dirs.tmpls}/namespace.yaml`,
    watcherServiceYaml: `${helm.dirs.tmpls}/watcher-service.yaml`,
    admissionServiceYaml: `${helm.dirs.tmpls}/admission-service.yaml`,
    mutationWebhookYaml: `${helm.dirs.tmpls}/mutation-webhook.yaml`,
    validationWebhookYaml: `${helm.dirs.tmpls}/validation-webhook.yaml`,
    admissionDeploymentYaml: `${helm.dirs.tmpls}/admission-deployment.yaml`,
    admissionServiceMonitorYaml: `${helm.dirs.tmpls}/admission-service-monitor.yaml`,
    watcherDeploymentYaml: `${helm.dirs.tmpls}/watcher-deployment.yaml`,
    watcherServiceMonitorYaml: `${helm.dirs.tmpls}/watcher-service-monitor.yaml`,
    tlsSecretYaml: `${helm.dirs.tmpls}/tls-secret.yaml`,
    apiTokenSecretYaml: `${helm.dirs.tmpls}/api-token-secret.yaml`,
    moduleSecretYaml: `${helm.dirs.tmpls}/module-secret.yaml`,
    storeRoleYaml: `${helm.dirs.tmpls}/store-role.yaml`,
    storeRoleBindingYaml: `${helm.dirs.tmpls}/store-role-binding.yaml`,
    clusterRoleYaml: `${helm.dirs.tmpls}/cluster-role.yaml`,
    clusterRoleBindingYaml: `${helm.dirs.tmpls}/cluster-role-binding.yaml`,
    serviceAccountYaml: `${helm.dirs.tmpls}/service-account.yaml`,
  };

  return helm;
}

export class Assets {
  readonly name: string;
  readonly tls: TLSOut;
  readonly apiToken: string;
  readonly alwaysIgnore!: WebhookIgnore;
  capabilities!: CapabilityExport[];

  image: string;
  buildTimestamp: string;
  hash: string;

  constructor(
    readonly config: ModuleConfig,
    readonly path: string,
    readonly host?: string,
  ) {
    this.name = `pepr-${config.uuid}`;
    this.buildTimestamp = `${Date.now()}`;
    this.alwaysIgnore = config.alwaysIgnore;
    this.image = `ghcr.io/defenseunicorns/pepr/controller:v${config.peprVersion}`;
    this.hash = "";
    // Generate the ephemeral tls things
    this.tls = genTLS(this.host || `${this.name}.pepr-system.svc`);

    // Generate the api token for the controller / webhook
    this.apiToken = crypto.randomBytes(32).toString("hex");
  }

  setHash = (hash: string): void => {
    this.hash = hash;
  };

  deploy = async (force: boolean, webhookTimeout?: number): Promise<void> => {
    this.capabilities = await loadCapabilities(this.path);
    await deploy(this, force, webhookTimeout);
  };

  zarfYaml = (path: string): string => zarfYaml(this, path);

  zarfYamlChart = (path: string): string => zarfYamlChart(this, path);

  allYaml = async (imagePullSecret?: string): Promise<string> => {
    this.capabilities = await loadCapabilities(this.path);
    // give error if namespaces are not respected
    for (const capability of this.capabilities) {
      namespaceComplianceValidator(capability, this.alwaysIgnore?.namespaces);
    }

    return allYaml(this, imagePullSecret);
  };

  /* eslint max-statements: ["warn", 21] */
  generateHelmChart = async (basePath: string): Promise<void> => {
    const helm = helmLayout(basePath, this.config.uuid);

    try {
      await Promise.all(
        Object.values(helm.dirs)
          .sort((l, r) => l.split("/").length - r.split("/").length)
          .map(async dir => await createDirectoryIfNotExists(dir)),
      );

      const code = await fs.readFile(this.path);

      const pairs: [string, () => string][] = [
        [helm.files.chartYaml, (): string => dedent(chartYaml(this.config.uuid, this.config.description || ""))],
        [helm.files.namespaceYaml, (): string => dedent(namespaceTemplate())],
        [helm.files.watcherServiceYaml, (): string => toYaml(watcherService(this.name))],
        [helm.files.admissionServiceYaml, (): string => toYaml(service(this.name))],
        [helm.files.tlsSecretYaml, (): string => toYaml(tlsSecret(this.name, this.tls))],
        [helm.files.apiTokenSecretYaml, (): string => toYaml(apiTokenSecret(this.name, this.apiToken))],
        [helm.files.storeRoleYaml, (): string => toYaml(storeRole(this.name))],
        [helm.files.storeRoleBindingYaml, (): string => toYaml(storeRoleBinding(this.name))],
        [helm.files.clusterRoleYaml, (): string => dedent(clusterRoleTemplate())],
        [helm.files.clusterRoleBindingYaml, (): string => toYaml(clusterRoleBinding(this.name))],
        [helm.files.serviceAccountYaml, (): string => toYaml(serviceAccount(this.name))],
        [helm.files.moduleSecretYaml, (): string => toYaml(getModuleSecret(this.name, code, this.hash))],
      ];
      await Promise.all(pairs.map(async ([file, content]) => await fs.writeFile(file, content())));

      await overridesFile(this, helm.files.valuesYaml);

      const [mutateWebhook, validateWebhook] = await Promise.all([
        webhookConfig(this, "mutate", this.config.webhookTimeout),
        webhookConfig(this, "validate", this.config.webhookTimeout),
      ]);

      if (validateWebhook || mutateWebhook) {
        await fs.writeFile(helm.files.admissionDeploymentYaml, dedent(admissionDeployTemplate(this.buildTimestamp)));
        await fs.writeFile(helm.files.admissionServiceMonitorYaml, dedent(serviceMonitorTemplate("admission")));
      }

      if (mutateWebhook) {
        await fs.writeFile(helm.files.mutationWebhookYaml, createWebhookYaml(this, mutateWebhook));
      }

      if (validateWebhook) {
        await fs.writeFile(helm.files.validationWebhookYaml, createWebhookYaml(this, validateWebhook));
      }

      const watchDeployment = getWatcher(this, this.hash, this.buildTimestamp);
      if (watchDeployment) {
        await fs.writeFile(helm.files.watcherDeploymentYaml, dedent(watcherDeployTemplate(this.buildTimestamp)));
        await fs.writeFile(helm.files.watcherServiceMonitorYaml, dedent(serviceMonitorTemplate("watcher")));
      }
    } catch (err) {
      console.error(`Error generating helm chart: ${err.message}`);
      process.exit(1);
    }
  };
}
